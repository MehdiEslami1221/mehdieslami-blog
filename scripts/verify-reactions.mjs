import assert from "node:assert/strict";
const api = process.env.REACTIONS_URL;
const base = new URL(process.env.SITE_URL);
base.protocol = "https:";
if (!base.pathname.endsWith("/")) base.pathname += "/";
assert.ok(api?.startsWith("https://"), "The deployment must export a reactions API URL");
async function text(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
  assert.ok(response.ok, "Published resource returned HTTP " + response.status);
  return response.text();
}
async function verify() {
  const feedURL = new URL("latest-posts.json", base);
  feedURL.searchParams.set("verify", String(Date.now()));
  const feed = JSON.parse(await text(feedURL));
  const samples = new Map();
  for (const post of [...feed.posts.fa, ...feed.posts.en]) samples.set(post.language, post);
  const scripts = new Set();
  for (const [lang, post] of samples) {
    const page = new URL(post.url);
    assert.equal(page.hostname, base.hostname);
    page.protocol = "https:";
    page.searchParams.set("verify", String(Date.now()));
    const html = await text(page);
    assert.ok(html.includes(lang === "fa" ? "این نوشته برایتان مفید بود؟" : "Was this post useful?"),
      "Published article is missing its localized reactions section");
    assert.ok(html.includes('aria-pressed="false"'), "Reaction buttons must expose their state");
    assert.ok(html.includes(lang === "fa" ? "گفت‌وگو دربارهٔ این نوشته" : "Join the discussion"),
      "Published article is missing its discussion form");
    assert.ok(html.includes('id="comment-name"') && html.includes('id="comment-body"'),
      "Published discussion is missing its accessible fields");
    assert.ok(html.includes("share-article"), "The existing copy-link action must remain");
    for (const match of html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)) {
      const script = new URL(match[1].replaceAll("&amp;", "&"), page);
      if (script.origin === page.origin) scripts.add(script.href);
    }
  }
  assert.ok(samples.size > 0, "No published articles available for verification");
  const bundles = await Promise.all([...scripts].map(url => text(url)));
  assert.ok(bundles.some(body => body.includes(api)), "Published client bundle is missing the deployed reactions API URL");
  const health = JSON.parse(await text(api + "/health"));
  assert.equal(health.ok, true);
  console.log("Published article HTML checked for: " + [...samples.keys()].join(", "));
  console.log("Reaction controls, discussion form, preserved share action, live API and bundled endpoint verified.");
}
let failure;
for (let attempt = 0; attempt < 6; attempt++) {
  try { await verify(); failure = null; break; }
  catch (error) { failure = error; if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 3000)); }
}
if (failure) throw failure;
