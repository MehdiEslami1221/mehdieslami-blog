import { readFile, appendFile } from "node:fs/promises";
import { createHash, randomBytes, publicEncrypt, pbkdf2Sync } from "node:crypto";
import { buildRegistry } from "../reactions/registry.mjs";

const ACCOUNT = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const TOKEN = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
const NAME = "mehdieslami-blog-reactions";
const OWNER = "MehdiEslami1221/mehdieslami-blog";
const ORIGIN = "https://blog.mehdieslami.ir";
const ALLOWED = JSON.stringify([ORIGIN, "http://blog.mehdieslami.ir"]);
async function api(path, method = "GET", body, allowMissing = false) {
  const form = body instanceof FormData;
  const response = await fetch("https://api.cloudflare.com/client/v4/accounts/" + ACCOUNT + path, {
    method, headers: { Authorization: "Bearer " + TOKEN,
      ...(!form && body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000)
  });
  if (allowMissing && response.status === 404) return null;
  let data;
  try { data = await response.json(); } catch { throw new Error("Cloudflare returned an unreadable response"); }
  if (!response.ok || data.success === false)
    throw new Error("Cloudflare " + method + " " + path.split("?")[0] + " failed: HTTP " +
      response.status + "; code " + (data.errors?.[0]?.code || "unknown") +
      ". Check the account ID and Workers Scripts / D1 Edit permissions.");
  return data.result;
}
async function main() {
  if (!/^[a-f0-9]{32}$/i.test(ACCOUNT) || !TOKEN)
    throw new Error("Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN as repository Actions secrets.");
  const { posts } = JSON.parse(await readFile("web/lib/generated/content.json", "utf8"));
  const registry = buildRegistry(posts);
  const source = await readFile("reactions/worker.mjs", "utf8");
  const adminSource = await readFile("reactions/admin-page.mjs", "utf8");
  const schema = await readFile("reactions/schema.sql", "utf8");
  const revision = createHash("sha256").update(source + adminSource + schema + ALLOWED).digest("hex");
  const subdomain = await api("/workers/subdomain");
  if (!subdomain?.subdomain || !/^[a-z0-9-]+$/i.test(subdomain.subdomain))
    throw new Error("Finish the free Workers & Pages onboarding and select a workers.dev subdomain.");
  const databases = await api("/d1/database?name=" + NAME);
  let database = databases.find(db => db.name === NAME);
  const fresh = !database;
  if (!database) database = await api("/d1/database", "POST", { name: NAME });
  if (!database?.uuid) throw new Error("Cloudflare did not return a database ID");
  const query = async (sql, params = []) => {
    const rows = await api("/d1/database/" + database.uuid + "/query", "POST",
      { sql, params: params.map(String) });
    if (!Array.isArray(rows) || rows.some(row => row.success === false))
      throw new Error("Reaction database migration/query failed");
    return rows;
  };
  if (!fresh) {
    let owner;
    try { owner = (await query("SELECT value FROM settings WHERE key = 'owner'"))[0].results?.[0]?.value; }
    catch { throw new Error("Existing reactions database has no ownership marker; refusing to overwrite it."); }
    if (owner !== OWNER) throw new Error("Existing reactions database belongs to a different project");
  }
  await query(schema);
  await query("INSERT INTO settings(key,value) VALUES('owner',?) ON CONFLICT(key) DO NOTHING", [OWNER]);
  await query("INSERT INTO settings(key,value) VALUES('signing-key',?) ON CONFLICT(key) DO NOTHING",
    [randomBytes(32).toString("hex")]);
  const secret = (await query("SELECT value FROM settings WHERE key = 'signing-key'"))[0].results?.[0]?.value;
  if (!/^[a-f0-9]{64}$/.test(secret || "")) throw new Error("Invalid private reaction signing key");
  await query("INSERT INTO settings(key,value) VALUES('articles',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE value != excluded.value",
    [JSON.stringify(registry)]);
  const labels = Object.fromEntries(posts.map(post => [post._id, {title:post.title,language:post.language,slug:post.slug}]));
  await query("INSERT INTO settings(key,value) VALUES('article-labels',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [JSON.stringify(labels)]);
  let initialPassword;
  if (!(await query("SELECT value FROM settings WHERE key='admin-password'"))[0].results?.length) {
    // First installation only. Plaintext never enters Git, settings, a bundle or logs.
    const password = randomBytes(24).toString("base64url");
    initialPassword = password;
    const salt = randomBytes(24).toString("hex");
    const verifier = { salt,iterations:100000,hash:pbkdf2Sync(password,salt,100000,32,"sha256").toString("hex") };
    const publicKey = await readFile("reactions/admin-bootstrap.pub","utf8");
    const envelope = publicEncrypt({key:publicKey,oaepHash:"sha256"},Buffer.from(password)).toString("base64");
    await query("INSERT INTO settings(key,value) VALUES('admin-password',?),('admin-bootstrap-envelope',?) ON CONFLICT(key) DO NOTHING", [JSON.stringify(verifier),envelope]);
  }
  const envelope = (await query("SELECT value FROM settings WHERE key='admin-bootstrap-envelope'"))[0].results?.[0]?.value;
  if (envelope) console.log("ADMIN_BOOTSTRAP_ENVELOPE=" + envelope);
  await query("DELETE FROM admin_sessions WHERE expires_at<=?", [Date.now()]);
  await query("DELETE FROM rate_limits WHERE window < ?", [Math.floor(Date.now() / 60000) - 1440]);
  const previous = (await query("SELECT value FROM settings WHERE key = 'worker-revision'"))[0].results?.[0]?.value;
  const existing = await api("/workers/scripts/" + NAME + "/settings", "GET", undefined, true);
  if (existing) {
    const binding = existing.bindings?.find(b => b.name === "DB");
    if (!binding || ![binding.id, binding.database_id].includes(database.uuid))
      throw new Error("An existing Worker with this name uses a different database; refusing to overwrite it.");
  }
  const changed = previous !== revision || !existing;
  if (changed) {
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify({
      main_module: "worker.mjs", compatibility_date: "2026-11-24",
      bindings: [
        { type: "d1", name: "DB", id: database.uuid },
        { type: "plain_text", name: "ALLOWED_ORIGINS", text: ALLOWED },
        { type: "plain_text", name: "REVISION", text: revision },
        { type: "secret_text", name: "VOTE_SECRET", text: secret }
      ]
    })], { type: "application/json" }));
    form.append("worker.mjs", new Blob([source], { type: "application/javascript+module" }), "worker.mjs");
    form.append("admin-page.mjs", new Blob([adminSource], { type: "application/javascript+module" }), "admin-page.mjs");
    await api("/workers/scripts/" + NAME, "PUT", form);
  }
  await api("/workers/scripts/" + NAME + "/subdomain", "POST", { enabled: true, previews_enabled: false });
  const endpoint = "https://" + NAME + "." + subdomain.subdomain + ".workers.dev";
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await fetch(endpoint + "/health", { signal: AbortSignal.timeout(5000), cache: "no-store" });
      const body = await response.json();
      if (response.ok && body.ok && body.revision === revision) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  if (!ready) throw new Error("Reaction Worker has not become healthy; the website deployment is stopped.");
  const adminPage = await fetch(endpoint + "/admin/", {signal:AbortSignal.timeout(10000)});
  if (!adminPage.ok || !(await adminPage.text()).includes("مدیریت دیدگاه‌ها")) throw new Error("Moderation page is unavailable");
  const privateList = await fetch(endpoint + "/admin/api/comments", {signal:AbortSignal.timeout(10000)});
  if (privateList.status !== 401 || privateList.headers.has("Access-Control-Allow-Origin"))
    throw new Error("Moderation API must require authentication");
  console.log("Moderation page ready; anonymous access to the private API is denied.");
  if (initialPassword) {
    const login = await fetch(endpoint + "/admin/api/login", {method:"POST",redirect:"error",
      headers:{Origin:endpoint,"Content-Type":"application/json"},body:JSON.stringify({password:initialPassword}),signal:AbortSignal.timeout(15000)});
    const auth = await login.json();
    const sessionCookie = login.headers.get("Set-Cookie")?.split(";")[0];
    if (!login.ok || !auth.csrf || !sessionCookie) throw new Error("Initial moderation sign-in check failed");
    try {
      const privateRead = await fetch(endpoint+"/admin/api/comments",{redirect:"error",headers:{Origin:endpoint,Cookie:sessionCookie},signal:AbortSignal.timeout(10000)});
      if (!privateRead.ok || !Array.isArray((await privateRead.json()).comments)) throw new Error("Private moderation queue check failed");
    } finally {
      const logout = await fetch(endpoint+"/admin/api/logout",{method:"POST",redirect:"error",headers:{Origin:endpoint,Cookie:sessionCookie,"X-CSRF-Token":auth.csrf,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(10000)});
      if (!logout.ok) throw new Error("Initial moderation logout check failed");
    }
    initialPassword = undefined;
    console.log("Initial administrator login, private queue and logout verified.");
  }

  const postId = Object.keys(registry)[0];
  if (postId) {
    const response = await fetch(endpoint + "/v1/reactions?post=" + encodeURIComponent(postId),
      { headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok || data.postId !== postId || !Number.isInteger(data.likes) ||
        !Number.isInteger(data.dislikes) || data.selected !== 0)
      throw new Error("Live reactions read check failed");
    const discussion = await fetch(endpoint + "/v1/comments?post=" + encodeURIComponent(postId),
      { headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(10000) });
    const comments = await discussion.json();
    if (!discussion.ok || comments.version !== 1 || comments.postId !== postId || !Array.isArray(comments.threads))
      throw new Error("Live discussion read check failed");
    console.log("Published discussion API and D1 read check passed.");
    // Exercise the actual deployed persistence only when the Worker implementation changes.
    // This temporary browser identity is reset to neutral before publishing the website.
    if (changed) {
      const token = randomBytes(32).toString("hex");
      async function vote(value) {
        const res = await fetch(endpoint + "/v1/reactions", {
          method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", "X-Voter-ID": token },
          body: JSON.stringify({ postId, vote: value }), signal: AbortSignal.timeout(10000)
        });
        const body = await res.json();
        if (!res.ok || body.selected !== value) throw new Error("Live reaction write check failed");
        return body;
      }
      try {
        await vote(1);
        await vote(1);
        const members = registry[postId];
        if (members.length === 2) {
          const shared = await fetch(endpoint + "/v1/reactions?post=" + encodeURIComponent(members.find(id => id !== postId)),
            { headers: { Origin: ORIGIN, "X-Voter-ID": token }, signal: AbortSignal.timeout(10000) });
          if (!shared.ok || (await shared.json()).selected !== 1)
            throw new Error("Live translated-reaction check failed");
        }
        await vote(-1);
      } finally {
        await vote(0);
      }
      const hashed = (await import("node:crypto")).createHmac("sha256", secret).update("voter:" + token).digest("hex");
      await query("DELETE FROM votes WHERE voter = ?", [hashed]);
      console.log("Live like, repeat, dislike and removal checks passed; temporary vote removed.");
    }
  }
  await query("INSERT INTO settings(key,value) VALUES('worker-revision',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [revision]);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, "url=" + endpoint + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    "### Article reactions\n\nAPI: " + endpoint + "\n\nPublished article registry: " + Object.keys(registry).length +
    " documents. Worker health and D1 read check passed.\n");
  console.log("Reactions API ready: " + endpoint);
  console.log("Moderation dashboard: " + endpoint + "/admin/");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
