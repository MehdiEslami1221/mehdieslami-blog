const TOKEN = /^[a-f0-9]{64}$/;
const POST_ID = /^[a-zA-Z0-9_.-]{1,128}$/;
export const RATE_LIMIT = 20;

class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
function json(value, status, origin, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Origin",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      ...extra
    }
  });
}
async function readBody(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    throw new HttpError(415, "json_required");
  if (Number(request.headers.get("Content-Length")) > 1024)
    throw new HttpError(413, "body_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "invalid_body");
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); throw new HttpError(413, "body_too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value;
  }
  catch { throw new HttpError(400, "invalid_body"); }
}
async function digest(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, "0")).join("");
}
export function countStatement(db, members) {
  const marks = members.map(() => "?").join(",");
  return db.prepare(
    "WITH ranked AS (SELECT vote, ROW_NUMBER() OVER (PARTITION BY voter ORDER BY id DESC) AS rank " +
    "FROM votes WHERE post_id IN (" + marks + ")) " +
    "SELECT COALESCE(SUM(vote = 1), 0) AS likes, COALESCE(SUM(vote = -1), 0) AS dislikes " +
    "FROM ranked WHERE rank = 1"
  ).bind(...members);
}
export async function snapshot(db, members, voter, postId) {
  const marks = members.map(() => "?").join(",");
  const counts = await countStatement(db, members).first();
  const mine = voter ? await db.prepare(
    "SELECT vote FROM votes WHERE post_id IN (" + marks + ") AND voter = ? ORDER BY id DESC LIMIT 1"
  ).bind(...members, voter).first() : null;
  return { version: 1, postId, likes: Number(counts.likes),
    dislikes: Number(counts.dislikes), selected: mine ? Number(mine.vote) : 0 };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET")
      return json({ ok: true, version: 1, revision: env.REVISION }, 200, null);
    let origin = null;
    try {
      const offered = request.headers.get("Origin");
      const allowed = JSON.parse(env.ALLOWED_ORIGINS || "[]");
      if (!offered || !Array.isArray(allowed) || !allowed.includes(offered))
        throw new HttpError(403, "origin_not_allowed");
      origin = offered;
      if (url.pathname !== "/v1/reactions") throw new HttpError(404, "not_found");
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: {
          "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Voter-ID", "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        } });
      if (!["GET", "POST"].includes(request.method)) throw new HttpError(405, "method_not_allowed");
      if (!env.DB || !env.VOTE_SECRET) throw new Error("unconfigured");
      const token = request.headers.get("X-Voter-ID");
      if ((request.method === "POST" && !token) || (token && !TOKEN.test(token)))
        throw new HttpError(400, "invalid_voter");
      const body = request.method === "POST" ? await readBody(request) : null;
      const postId = body?.postId ?? url.searchParams.get("post");
      if (typeof postId !== "string" || !POST_ID.test(postId) || postId.startsWith("drafts."))
        throw new HttpError(400, "invalid_post");
      const registry = JSON.parse(await env.DB.prepare("SELECT value FROM settings WHERE key = 'articles'").first("value") || "{}");
      if (!Object.hasOwn(registry, postId)) throw new HttpError(404, "unknown_post");
      const members = registry[postId];
      if (!Array.isArray(members) || !members.length || members.length > 2 ||
          !members.every(id => typeof id === "string" && POST_ID.test(id)))
        throw new Error("invalid_registry");
      const voter = token ? await digest(env.VOTE_SECRET, "voter:" + token) : null;
      if (request.method === "POST") {
        if (![1, -1, 0].includes(body.vote)) throw new HttpError(400, "invalid_vote");
        const ip = request.headers.get("CF-Connecting-IP");
        if (!ip) throw new HttpError(503, "unavailable");
        const bucket = await digest(env.VOTE_SECRET, "ip:" + ip);
        const window = Math.floor(Date.now() / 60000);
        const limit = await env.DB.prepare(
          "INSERT INTO rate_limits(bucket, window, count) VALUES(?, ?, 1) " +
          "ON CONFLICT(bucket) DO UPDATE SET window = excluded.window, " +
          "count = CASE WHEN rate_limits.window = excluded.window THEN rate_limits.count + 1 ELSE 1 END " +
          "WHERE rate_limits.window != excluded.window OR rate_limits.count < ?"
        ).bind(bucket, window, RATE_LIMIT).run();
        if (!limit.meta.changes) throw new HttpError(429, "rate_limited");
        // Replacing moves this browser's latest choice to the end of the sequence.
        // Keep vote=0 as a tombstone so a vote in the other translation cannot reappear.
        await env.DB.prepare("INSERT OR REPLACE INTO votes(post_id, voter, vote) VALUES(?, ?, ?)")
          .bind(postId, voter, body.vote).run();
      }
      return json(await snapshot(env.DB, members, voter, postId), 200, origin);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      return json({ error: status === 503 ? "unavailable" : error.message }, status, origin,
        status === 429 ? { "Retry-After": "60" } : {});
    }
  }
};
