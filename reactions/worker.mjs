import { adminPage, adminScript } from "./admin-page.mjs";
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
async function readBody(request, maximum = 1024) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    throw new HttpError(415, "json_required");
  if (Number(request.headers.get("Content-Length")) > maximum)
    throw new HttpError(413, "body_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "invalid_body");
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) { await reader.cancel(); throw new HttpError(413, "body_too_large"); }
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
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return admin(request, env);
    if (url.pathname === "/health" && request.method === "GET")
      return json({ ok: true, version: 1, revision: env.REVISION }, 200, null);
    let origin = null;
    try {
      const offered = request.headers.get("Origin");
      const allowed = JSON.parse(env.ALLOWED_ORIGINS || "[]");
      if (!offered || !Array.isArray(allowed) || !allowed.includes(offered))
        throw new HttpError(403, "origin_not_allowed");
      origin = offered;
      if (!["/v1/reactions", "/v1/comments"].includes(url.pathname)) throw new HttpError(404, "not_found");
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
      const body = request.method === "POST" ? await readBody(request, url.pathname === "/v1/comments" ? 12288 : 1024) : null;
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
      if (url.pathname === "/v1/comments")
        return json(await comments(request, url, body, env, members, voter, postId), 200, origin);
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
        status === 429 ? { "Retry-After": url.pathname === "/v1/comments" ? "600" : "60" } : {});
    }
  }
};


const COMMENT_ID = /^[a-f0-9]{32}$/;
const approved = "COALESCE((SELECT state FROM comment_moderation WHERE comment_id=comments.id),'pending') = 'approved'";
const columns = "id, seq, post_id, parent_id, name, body, language, created_at, deleted, voter";
function publicComment(row, voter) {
  return { id: row.id, sequence: row.seq, parentId: row.parent_id,
    name: row.deleted ? "" : row.name, body: row.deleted ? "" : row.body,
    language: row.language, createdAt: new Date(row.created_at).toISOString(),
    deleted: Boolean(row.deleted), mine: Boolean(voter && row.voter === voter) };
}
async function commentLimit(env, voter, request, action) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) throw new HttpError(503, "unavailable");
  const window = Math.floor(Date.now() / 60000 / 10) * 10;
  for (const [label, value, maximum] of [["network", ip, 8], ["browser", voter, 4]]) {
    const bucket = await digest(env.VOTE_SECRET, "comments:" + action + ":" + label + ":" + value);
    const result = await env.DB.prepare(
      "INSERT INTO rate_limits(bucket, window, count) VALUES(?, ?, 1) " +
      "ON CONFLICT(bucket) DO UPDATE SET window = excluded.window, " +
      "count = CASE WHEN rate_limits.window = excluded.window THEN rate_limits.count + 1 ELSE 1 END " +
      "WHERE rate_limits.window != excluded.window OR rate_limits.count < ?"
    ).bind(bucket, window, maximum).run();
    if (!result.meta.changes) throw new HttpError(429, "rate_limited");
  }
}
async function comments(request, url, body, env, members, voter, postId) {
  const db = env.DB;
  const marks = members.map(() => "?").join(",");
  if (request.method === "POST") {
    if (!voter) throw new HttpError(400, "invalid_voter");
    if (typeof body.id !== "string" || !COMMENT_ID.test(body.id)) throw new HttpError(400, "invalid_comment");
    if (body.action === "delete") {
      const row = await db.prepare("SELECT " + columns + " FROM comments WHERE id = ? AND post_id IN (" + marks + ")")
        .bind(body.id, ...members).first();
      if (!row || row.voter !== voter) throw new HttpError(404, "unknown_comment");
      if (!row.deleted) {
        await commentLimit(env, voter, request, "delete");
        await db.prepare("UPDATE comments SET deleted=1, name='', body='' WHERE id=? AND voter=?").bind(body.id, voter).run();
      }
      return { version: 1, deleted: true, id: body.id };
    }
    if (body.action !== undefined && body.action !== "create") throw new HttpError(400, "invalid_action");
    if (body.website) throw new HttpError(400, "invalid_comment");
    const name = typeof body.name === "string" ? body.name.normalize("NFC").trim() : "";
    const text = typeof body.body === "string" ? body.body.normalize("NFC").trim() : "";
    if (!name || name.length > 60 || /[\p{Cc}\p{Cf}]/u.test(name.replaceAll("\u200c", "")) ||
        !text || text.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(text) ||
        !["fa", "en"].includes(body.language)) throw new HttpError(400, "invalid_comment");
    const parent = body.parentId ?? null;
    if (parent !== null && (typeof parent !== "string" || !COMMENT_ID.test(parent)))
      throw new HttpError(400, "invalid_parent");
    const existing = await db.prepare("SELECT " + columns + " FROM comments WHERE id=?").bind(body.id).first();
    if (existing) {
      if (existing.voter !== voter || existing.post_id !== postId || existing.parent_id !== parent ||
          existing.name !== name || existing.body !== text || existing.language !== body.language || existing.deleted)
        throw new HttpError(409, "id_conflict");
      return await receipt(db, existing.id);
    }
    if (parent) {
      const target = await db.prepare("SELECT id FROM comments WHERE id=? AND parent_id IS NULL AND deleted=0 AND " + approved + " AND post_id IN (" + marks + ")")
        .bind(parent, ...members).first();
      if (!target) throw new HttpError(400, "invalid_parent");
    }
    await commentLimit(env, voter, request, "create");
    // Ignore an identical concurrent retry; the request ID belongs to its original author.
    await db.prepare("INSERT OR IGNORE INTO comments(id,post_id,parent_id,voter,name,body,language,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .bind(body.id, postId, parent, voter, name, text, body.language, Date.now()).run();
    const saved = await db.prepare("SELECT " + columns + " FROM comments WHERE id=?").bind(body.id).first();
    if (!saved || saved.voter !== voter || saved.post_id !== postId || saved.parent_id !== parent ||
        saved.name !== name || saved.body !== text || saved.language !== body.language || saved.deleted) throw new HttpError(409, "id_conflict");
    return await receipt(db, saved.id);
  }
  const rawBefore = url.searchParams.get("before");
  const before = rawBefore === null ? Number.MAX_SAFE_INTEGER : Number(rawBefore);
  if (!Number.isSafeInteger(before) || before < 1) throw new HttpError(400, "invalid_cursor");
  const parent = url.searchParams.get("parent");
  if (parent && !COMMENT_ID.test(parent)) throw new HttpError(400, "invalid_parent");
  if (parent) {
    const root = await db.prepare("SELECT id FROM comments WHERE id=? AND parent_id IS NULL AND " + approved + " AND post_id IN (" + marks + ")")
      .bind(parent, ...members).first();
    if (!root) throw new HttpError(404, "unknown_comment");
    const { results } = await db.prepare("SELECT " + columns + " FROM comments WHERE parent_id=? AND " + approved + " AND post_id IN (" + marks + ") AND seq < ? ORDER BY seq DESC LIMIT 11")
      .bind(parent, ...members, before).all();
    const page = results.slice(0,10);
    return { version: 1, postId, comments: page.map(row => publicComment(row,voter)).reverse(),
      next: results.length > 10 ? page.at(-1).seq : null };
  }
  const { results } = await db.prepare("SELECT " + columns + " FROM comments WHERE post_id IN (" + marks + ") AND parent_id IS NULL AND " + approved + " AND seq < ? ORDER BY seq DESC LIMIT 11")
    .bind(...members, before).all();
  const roots = results.slice(0,10);
  const threads = [];
  for (const row of roots) {
    const { results: replies } = await db.prepare("SELECT " + columns + " FROM comments WHERE parent_id=? AND " + approved + " AND post_id IN (" + marks + ") ORDER BY seq DESC LIMIT 11")
      .bind(row.id, ...members).all();
    const page = replies.slice(0,10);
    threads.push({ ...publicComment(row,voter), replies: page.map(reply => publicComment(reply,voter)).reverse(),
      nextReply: replies.length > 10 ? page.at(-1).seq : null });
  }
  return { version: 1, postId, threads, next: results.length > 10 ? roots.at(-1).seq : null };
}

async function receipt(db, id) {
  const row = await db.prepare("SELECT state FROM comment_moderation WHERE comment_id=?").bind(id).first();
  return { version: 1, id, status: row?.state || "pending" };
}

function hex(bytes) { return Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,"0")).join(""); }
function randomHex(length = 32) { return hex(crypto.getRandomValues(new Uint8Array(length))); }
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let difference = 0;
  for (let i=0;i<a.length;i++) difference |= a.charCodeAt(i)^b.charCodeAt(i);
  return difference === 0;
}
export async function passwordRecord(password, salt = randomHex(24)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",iterations:100000,
    salt:new TextEncoder().encode(salt)},key,256);
  return { salt, iterations:100000, hash:hex(bits) };
}
async function setting(db, key) { return db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first("value"); }
async function validPassword(db, password) {
  if (typeof password !== "string" || password.length > 256) return false;
  const saved = JSON.parse(await setting(db,"admin-password") || "null");
  if (!saved || !/^[a-f0-9]{48}$/.test(saved.salt) || !TOKEN.test(saved.hash) || saved.iterations !== 100000)
    throw new Error("admin_unconfigured");
  return same((await passwordRecord(password,saved.salt)).hash,saved.hash);
}
const adminCookie = "__Host-journal-admin";
function cookie(value, duration = 28800) {
  return adminCookie + "=" + value + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + duration;
}
const securityHeaders = {
  "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff", "X-Frame-Options":"DENY",
  "Referrer-Policy":"no-referrer", "X-Robots-Tag":"noindex, nofollow, noarchive",
  "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()"
};
function adminResponse(body, status=200, headers={}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {status,headers:{
    ...securityHeaders,"Content-Type":"application/json; charset=utf-8",...headers
  }});
}
async function adminLimit(request, env, scope, maximum) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) throw new HttpError(503,"unavailable");
  const bucket = await digest(env.VOTE_SECRET,"admin:"+scope+":"+ip);
  const window = Math.floor(Date.now()/900000)*15;
  const result = await env.DB.prepare(
    "INSERT INTO rate_limits(bucket, window, count) VALUES(?, ?, 1) " +
    "ON CONFLICT(bucket) DO UPDATE SET window=excluded.window, count=CASE WHEN rate_limits.window=excluded.window THEN rate_limits.count+1 ELSE 1 END " +
    "WHERE rate_limits.window!=excluded.window OR rate_limits.count < ?"
  ).bind(bucket,window,maximum).run();
  if (!result.meta.changes) throw new HttpError(429,"rate_limited");
}
async function session(request, env) {
  const offered = request.headers.get("Cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(adminCookie+"="))?.slice(adminCookie.length+1);
  if (!offered || !TOKEN.test(offered)) throw new HttpError(401,"unauthorized");
  const hash = await digest(env.VOTE_SECRET,"admin-session:"+offered);
  const saved = await env.DB.prepare("SELECT token_hash,csrf,expires_at FROM admin_sessions WHERE token_hash=? AND expires_at>?").bind(hash,Date.now()).first();
  if (!saved) throw new HttpError(401,"unauthorized");
  if (request.method !== "GET" && !same(request.headers.get("X-CSRF-Token"),saved.csrf)) throw new HttpError(403,"csrf_required");
  return saved;
}
async function admin(request, env) {
  const url = new URL(request.url);
  try {
    if (url.protocol !== "https:" && !["127.0.0.1","localhost"].includes(url.hostname)) throw new HttpError(403,"https_required");
    if ((url.pathname === "/admin" || url.pathname === "/admin/") && request.method === "GET")
      return adminResponse(adminPage,200,{"Content-Type":"text/html; charset=utf-8"});
    if (url.pathname === "/admin/app.js" && request.method === "GET")
      return adminResponse(adminScript,200,{"Content-Type":"text/javascript; charset=utf-8"});
    if (!["/admin/api/login","/admin/api/session","/admin/api/logout","/admin/api/comments","/admin/api/moderate","/admin/api/password"].includes(url.pathname)) throw new HttpError(404,"not_found");
    const origin = request.headers.get("Origin");
    if ((request.method !== "GET" && origin !== url.origin) || (origin && origin !== url.origin)) throw new HttpError(403,"origin_not_allowed");
    if (!env.DB || !env.VOTE_SECRET) throw new Error("unconfigured");
    const expected = ["/admin/api/session","/admin/api/comments"].includes(url.pathname) ? "GET" : "POST";
    if (request.method !== expected) throw new HttpError(405,"method_not_allowed");
    const body = request.method === "POST" ? await readBody(request,4096) : null;
    if (url.pathname === "/admin/api/login") {
      await adminLimit(request,env,"login",5);
      if (!await validPassword(env.DB,body.password)) throw new HttpError(401,"invalid_password");
      const token = randomHex(), csrf = randomHex();
      const tokenHash = await digest(env.VOTE_SECRET,"admin-session:"+token);
      await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(Date.now()).run();
      await env.DB.prepare("INSERT INTO admin_sessions(token_hash,csrf,expires_at) VALUES(?,?,?)").bind(tokenHash,csrf,Date.now()+28800000).run();
      return adminResponse({ok:true,csrf},200,{"Set-Cookie":cookie(token)});
    }
    const current = await session(request,env);
    if (url.pathname === "/admin/api/session") return adminResponse({ok:true,csrf:current.csrf,expiresAt:current.expires_at});
    if (url.pathname === "/admin/api/logout") {
      await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(current.token_hash).run();
      return adminResponse({ok:true},200,{"Set-Cookie":cookie("",0)});
    }
    if (url.pathname === "/admin/api/password") {
      await adminLimit(request,env,"password",5);
      if (typeof body.newPassword !== "string" || body.newPassword.length < 16 || body.newPassword.length > 256)
        throw new HttpError(400,"invalid_new_password");
      if (!await validPassword(env.DB,body.currentPassword)) throw new HttpError(401,"invalid_password");
      const saved = JSON.stringify(await passwordRecord(body.newPassword));
      await env.DB.batch([
        env.DB.prepare("UPDATE settings SET value=? WHERE key='admin-password'").bind(saved),
        env.DB.prepare("DELETE FROM admin_sessions"),
        env.DB.prepare("DELETE FROM settings WHERE key='admin-bootstrap-envelope'")
      ]);
      return adminResponse({ok:true},200,{"Set-Cookie":cookie("",0)});
    }
    if (url.pathname === "/admin/api/moderate") {
      if (!COMMENT_ID.test(body.id || "") || !["approved","rejected","removed"].includes(body.state)) throw new HttpError(400,"invalid_moderation");
      const row = await env.DB.prepare("SELECT id,parent_id,deleted FROM comments WHERE id=?").bind(body.id).first();
      if (!row) throw new HttpError(404,"unknown_comment");
      if (body.state === "approved") {
        if (row.deleted) throw new HttpError(409,"author_removed");
        if (row.parent_id) {
          const parent = await env.DB.prepare("SELECT id FROM comments WHERE id=? AND deleted=0 AND " + approved).bind(row.parent_id).first();
          if (!parent) throw new HttpError(409,"parent_not_approved");
        }
      }
      await env.DB.prepare("INSERT INTO comment_moderation(comment_id,state,updated_at) VALUES(?,?,?) ON CONFLICT(comment_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at")
        .bind(row.id,body.state,Date.now()).run();
      return adminResponse({ok:true,id:row.id,state:body.state});
    }
    const filter = url.searchParams.get("state") || "pending";
    if (!["pending","approved","rejected","removed","all"].includes(filter)) throw new HttpError(400,"invalid_filter");
    const before = Number(url.searchParams.get("before") || Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(before) || before < 1) throw new HttpError(400,"invalid_cursor");
    const stateSQL = "CASE WHEN c.deleted=1 THEN 'removed' ELSE COALESCE(m.state,'pending') END";
    const {results} = await env.DB.prepare("SELECT c.id,c.seq,c.post_id,c.parent_id,c.name,c.body,c.language,c.created_at,c.deleted," + stateSQL + " AS status, " +
      "p.name AS parent_name,p.body AS parent_body,COALESCE(pm.state,'pending') AS parent_status,p.deleted AS parent_deleted " +
      "FROM comments c LEFT JOIN comment_moderation m ON m.comment_id=c.id LEFT JOIN comments p ON p.id=c.parent_id " +
      "LEFT JOIN comment_moderation pm ON pm.comment_id=p.id WHERE c.seq < ? " + (filter === "all" ? "" : "AND "+stateSQL+"=? ") + "ORDER BY c.seq DESC LIMIT 21")
      .bind(...(filter === "all" ? [before] : [before,filter])).all();
    const labels = JSON.parse(await setting(env.DB,"article-labels") || "{}");
    const registry = JSON.parse(await setting(env.DB,"articles") || "{}");
    const rows = results.slice(0,20).map(row=>({id:row.id,sequence:row.seq,postId:row.post_id,
      name:row.name,body:row.body,language:row.language,createdAt:new Date(row.created_at).toISOString(),
      status:row.status,authorRemoved:Boolean(row.deleted),article:labels[row.post_id] || null,published:Object.hasOwn(registry,row.post_id),
      parent:row.parent_id ? {name:row.parent_name||"",body:row.parent_body||"",status:row.parent_deleted?"removed":row.parent_status} : null}));
    const {results: counts} = await env.DB.prepare("SELECT " + stateSQL + " AS status,COUNT(*) AS total FROM comments c LEFT JOIN comment_moderation m ON m.comment_id=c.id GROUP BY 1").all();
    return adminResponse({comments:rows,next:results.length>20?rows.at(-1).sequence:null,counts:Object.fromEntries(counts.map(row=>[row.status,Number(row.total)]))});
  } catch(error) {
    const status = error instanceof HttpError ? error.status : 503;
    return adminResponse({error:status===503?"unavailable":error.message},status,status===429?{"Retry-After":"900"}:{});
  }
}
