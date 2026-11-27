import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../../reactions/worker.mjs";
import { buildRegistry } from "../../reactions/registry.mjs";
const origin = "https://blog.mehdieslami.ir";
const alice = "a".repeat(64);
const source = [
  { _id: "fa-one", language: "fa", slug: "first", publishedAt: "2026-01-01" },
  { _id: "en-one", language: "en", slug: "first-en", publishedAt: "2026-01-01", translation: { language: "fa", slug: "first" } }
];
export function setup(t, initial = buildRegistry(source)) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../../reactions/schema.sql", import.meta.url), "utf8"));
  function prepare(sql, params = []) {
    return {
      bind(...args) { return prepare(sql, args); },
      async first(column) {
        const row = sqlite.prepare(sql).get(...params);
        return column ? (row?.[column] ?? null) : (row ?? null);
      },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
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
