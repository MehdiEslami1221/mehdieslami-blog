import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker, { RATE_LIMIT } from "../reactions/worker.mjs";
import { buildRegistry } from "../reactions/registry.mjs";
const origin = "https://blog.mehdieslami.ir";
const alice = "a".repeat(64), bob = "b".repeat(64);
const source = [
  { _id: "fa-one", language: "fa", slug: "first", publishedAt: "2026-01-01" },
  { _id: "en-one", language: "en", slug: "first-en", publishedAt: "2026-01-01", translation: { language: "fa", slug: "first" } }
];
function setup(t, initial = buildRegistry(source)) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../reactions/schema.sql", import.meta.url), "utf8"));
  function prepare(sql, params = []) {
    return {
      bind(...args) { return prepare(sql, args); },
      async first(column) {
        const row = sqlite.prepare(sql).get(...params);
        return column ? (row?.[column] ?? null) : (row ?? null);
      },
      async run() {
        const result = sqlite.prepare(sql).run(...params);
        return { success: true, meta: { changes: Number(result.changes) } };
      }
    };
  }
  const env = { DB: { prepare }, VOTE_SECRET: "test-only-secret", ALLOWED_ORIGINS: JSON.stringify([origin]), REVISION: "test" };
  function registry(value) {
    sqlite.prepare("INSERT INTO settings(key,value) VALUES('articles',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(value));
  }
  registry(initial);
  async function call({ post = "fa-one", token = alice, vote, ip = "192.0.2.1", from = origin, method, raw, headers = {} } = {}) {
    method ||= vote === undefined && raw === undefined ? "GET" : "POST";
    const response = await worker.fetch(new Request("https://reactions.example/v1/reactions?post=" + encodeURIComponent(post), {
      method,
      headers: { ...(from ? { Origin: from } : {}), ...(token ? { "X-Voter-ID": token } : {}),
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}), "CF-Connecting-IP": ip, ...headers },
      ...(["POST", "PUT"].includes(method) ? { body: raw ?? JSON.stringify({ postId: post, vote }) } : {})
    }), env);
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data, headers: response.headers };
  }
  t.after(() => sqlite.close());
  return { call, sqlite, env, registry };
}
test("Published translations share one registry group, including one-way links and slug changes", () => {
  const registry = buildRegistry(source);
  assert.deepEqual(registry["fa-one"], ["en-one", "fa-one"]);
  assert.deepEqual(registry["en-one"], ["en-one", "fa-one"]);
  const renamed = source.map(p => p._id === "en-one" ? { ...p, slug: "renamed" } : p);
  assert.deepEqual(buildRegistry(renamed), registry);
  assert.deepEqual(buildRegistry([source[1]])["en-one"], ["en-one"]);
  assert.deepEqual(Object.keys(buildRegistry([])), []);
  assert.throws(() => buildRegistry([...source, { _id: "fa-two", language: "fa", slug: "second",
    translation: { language: "en", slug: "first-en" } }]), /one post per language/);
});
test("A browser can like, repeat, switch across translations and remove without duplicate counts", async t => {
  const { call, sqlite } = setup(t);
  const zero = await call();
  assert.deepEqual(zero.data, { version: 1, postId: "fa-one", likes: 0, dislikes: 0, selected: 0 });
  assert.equal((await call({ vote: 1 })).data.likes, 1);
  assert.equal((await call({ vote: 1 })).data.likes, 1);
  const other = await call({ post: "en-one", token: bob, vote: -1 });
  assert.equal(other.data.likes, 1); assert.equal(other.data.dislikes, 1);
  const switched = await call({ post: "en-one", vote: -1 });
  assert.equal(switched.data.likes, 0); assert.equal(switched.data.dislikes, 2);
  assert.equal((await call()).data.selected, -1);
  const removed = await call({ vote: 0 });
  assert.equal(removed.data.likes, 0); assert.equal(removed.data.dislikes, 1);
  assert.equal((await call({ post: "en-one" })).data.selected, 0);
  const stored = sqlite.prepare("SELECT voter FROM votes").all();
  assert.ok(stored.every(row => row.voter !== alice && row.voter !== bob));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM votes").get().n, 3);
});
test("Linking translations after votes exist counts the latest choice per browser once", async t => {
  const { call, registry } = setup(t, { "fa-one": ["fa-one"], "en-one": ["en-one"] });
  await call({ vote: 1 });
  await call({ post: "en-one", vote: -1 });
  registry(buildRegistry(source));
  const joined = await call();
  assert.equal(joined.data.likes, 0); assert.equal(joined.data.dislikes, 1);
  assert.equal(joined.data.selected, -1);
  await call({ vote: 0 });
  const cleared = await call({ post: "en-one" });
  assert.equal(cleared.data.likes + cleared.data.dislikes, 0);
  assert.equal(cleared.data.selected, 0);
});
test("Concurrent repeated requests remain one vote per browser and survive new handler calls", async t => {
  const { call } = setup(t);
  const responses = await Promise.all(Array.from({ length: 8 }, () => call({ vote: 1 })));
  assert.ok(responses.every(r => r.status === 200));
  assert.equal((await call()).data.likes, 1);
  assert.equal((await call({ post: "en-one" })).data.selected, 1);
});
test("Unknown articles, arbitrary origins, invalid identifiers and payloads cannot cast votes", async t => {
  const { call, sqlite } = setup(t);
  assert.equal((await call({ post: "missing", vote: 1 })).status, 404);
  assert.equal((await call({ post: "drafts.hidden", vote: 1 })).status, 400);
  assert.equal((await call({ from: "https://evil.example", vote: 1 })).status, 403);
  assert.equal((await call({ from: null, vote: 1 })).status, 403);
  assert.equal((await call({ token: null, vote: 1 })).status, 400);
  assert.equal((await call({ token: "invalid", vote: 1 })).status, 400);
  assert.equal((await call({ vote: 2 })).status, 400);
  assert.equal((await call({ vote: "1" })).status, 400);
  assert.equal((await call({ raw: "null" })).status, 400);
  assert.equal((await call({ raw: "not-json" })).status, 400);
  assert.equal((await call({ raw: JSON.stringify({ postId: "fa-one", vote: 1, excess: "x".repeat(1200) }) })).status, 413);
  assert.equal((await call({ vote: 1, headers: { "Content-Type": "text/plain" } })).status, 415);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM votes").get().n, 0);
});
test("CORS, public counts and method limits are explicit; backend failures do not invent counters", async t => {
  const { call, env } = setup(t);
  const preflight = await call({ method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /X-Voter-ID/);
  const unknown = await call({ from: "https://evil.example" });
  assert.equal(unknown.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal((await call({ method: "DELETE" })).status, 405);
  assert.equal((await call({ token: null })).status, 200);
  env.DB = { prepare() { throw new Error("private database details"); } };
  const failed = await call();
  assert.equal(failed.status, 503);
  assert.deepEqual(failed.data, { error: "unavailable" });
});
test("Rate limiting is atomic per network, does not expose IPs and resets in a later window", async t => {
  const { call, sqlite } = setup(t);
  for (let i = 0; i < RATE_LIMIT; i++) assert.equal((await call({ vote: 1 })).status, 200);
  const denied = await call({ vote: -1 });
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get("Retry-After"), "60");
  assert.equal((await call()).data.selected, 1);
  assert.notEqual(sqlite.prepare("SELECT bucket FROM rate_limits").get().bucket, "192.0.2.1");
  sqlite.prepare("UPDATE rate_limits SET window = 0").run();
  assert.equal((await call({ vote: -1 })).status, 200);
  assert.equal((await call()).data.dislikes, 1);
});
