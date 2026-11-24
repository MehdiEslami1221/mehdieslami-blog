import test from "node:test";
import assert from "node:assert/strict";
import {
  validSlug,
  safeLink,
  imageURL,
  normalizePosts,
  readingMinutes,
  rss,
  postPath,
} from "../scripts/content-core.mjs";
const post = (changes = {}) => ({
  _id: "p1",
  title: "A & B",
  slug: "a-b",
  language: "en",
  publishedAt: "2026-01-01T00:00:00Z",
  excerpt: '<test> & "text"',
  body: [{ _type: "block", children: [{ text: "hello world" }] }],
  ...changes,
});
test("Public article paths accept Persian and English slugs and reject traversal, separators and URL controls", () => {
  for (const slug of ["java-spring", "تجربه-جاوا", "next-16"])
    assert.equal(validSlug(slug), true);
  for (const slug of [
    "../test",
    "a/b",
    "a%2fb",
    "a?x",
    "a#x",
    "-bad",
    "a--b",
    "a_b",
    "",
    "a".repeat(121),
  ])
    assert.equal(validSlug(slug), false);
  assert.equal(postPath(post()), "/en/posts/a-b/");
  assert.equal(
    postPath(post({ language: "fa", slug: "تجربه" })),
    "/posts/%D8%AA%D8%AC%D8%B1%D8%A8%D9%87/",
  );
});
test("External links and image sources cannot execute scripts or load arbitrary asset hosts", () => {
  assert.equal(safeLink("javascript:alert(1)"), undefined);
  assert.equal(safeLink("data:text/html,hello"), undefined);
  assert.equal(safeLink("https://example.com/"), "https://example.com/");
  assert.equal(
    imageURL("https://cdn.sanity.io/images/x/y/a.jpg"),
    "https://cdn.sanity.io/images/x/y/a.jpg",
  );
  assert.equal(imageURL("https://cdn.sanity.io.evil.test/x"), undefined);
  assert.equal(imageURL("http://cdn.sanity.io/a.jpg"), undefined);
});
test("Drafts and future posts stay unpublished; duplicate URLs fail instead of replacing an article", () => {
  const result = normalizePosts(
    [
      post({ _id: "drafts.p1" }),
      post({ _id: "future", publishedAt: "2099-01-01" }),
      post(),
    ],
    Date.parse("2026-11-24"),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]._id, "p1");
  assert.throws(
    () => normalizePosts([post(), post({ _id: "p2" })]),
    /Duplicate/,
  );
  assert.equal(
    normalizePosts([post(), post({ _id: "p2", language: "fa" })]).length,
    2,
  );
  assert.throws(() => normalizePosts([post({ slug: "../broken" })]), /Invalid/);
  assert.throws(() => normalizePosts({}), /invalid post collection/);
});
test("Metadata uses bounded descriptions, honest reading estimates and validated categories", () => {
  const p = normalizePosts([
    post({
      excerpt: "x".repeat(500),
      tags: ["java", 5, "web"],
      cover: { url: "https://evil.test/image.png" },
      category: { slug: "../bad", titleFa: "الف", titleEn: "Bad" },
    }),
  ])[0];
  assert.equal(p.excerpt.length, 400);
  assert.deepEqual(p.tags, ["java", "web"]);
  assert.equal(p.cover, undefined);
  assert.equal(p.category, undefined);
  assert.equal(readingMinutes([]), 1);
  assert.equal(
    readingMinutes([
      { _type: "block", children: [{ text: "word ".repeat(401) }] },
    ]),
    3,
  );
});
test("RSS preserves Unicode, escapes XML and includes only its own language with canonical article URLs", () => {
  const result = rss(
    normalizePosts([
      post(),
      post({ _id: "p2", language: "fa", slug: "فارسی" }),
    ]),
    "https://example.com/blog",
    "en",
  );
  assert.match(result, /<title>A &amp; B<\/title>/);
  assert.match(result, /&lt;test&gt; &amp; &quot;text&quot;/);
  assert.match(result, /https:\/\/example.com\/blog\/en\/posts\/a-b\//);
  assert.doesNotMatch(result, /%D9%81/);
});

test("A published Sanity post with null optional projections still produces readable content and a feed entry", () => {
  const image = "https://cdn.sanity.io/images/project/production/cover.webp";
  const input = post({
    featured: null,
    seoTitle: null,
    seoDescription: null,
    translation: null,
    cover: { url: image, alt: "Issue form", caption: null },
    body: [
      {
        _type: "block",
        _key: "text",
        asset: null,
        children: [{ _type: "span", text: "Published article" }],
      },
      {
        _type: "image",
        _key: "image",
        asset: { url: image },
        alt: "Issue form",
      },
    ],
  });
  const [article] = JSON.parse(JSON.stringify(normalizePosts([input])));
  assert.equal(article.title, input.title);
  assert.equal(article.body[0].children[0].text, "Published article");
  assert.equal(article.body[1].asset.url, image);
  assert.equal(article.cover.url, image);
  assert.equal(article.cover.alt, "Issue form");
  assert.equal(article.readingMinutes, 1);
  assert.equal(article.featured, false);
  for (const key of ["seoTitle", "seoDescription", "translation"])
    assert.equal(key in article, false);
  assert.equal("asset" in article.body[0], false);
  assert.equal("caption" in article.cover, false);
  assert.match(rss([article], "https://example.com", "en"), /<item>/);
});
