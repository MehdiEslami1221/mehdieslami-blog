import test from "node:test";
import assert from "node:assert/strict";
import { postListing } from "../web/lib/post-list.mjs";
const post = (slug, language, translation) => ({
  slug,
  language,
  translation,
  publishedAt: "2026-01-01",
});
test("A Persian-only journal remains readable from its English interface", () => {
  const fa = post("first", "fa");
  assert.deepEqual(postListing([fa], "en"), [fa]);
  assert.deepEqual(postListing([], "en"), []);
});
test("Published translations replace duplicates, including one-way translation references", () => {
  const fa = post("first", "fa");
  const en = post("first-en", "en", { language: "fa", slug: "first" });
  const other = post("other", "fa");
  assert.deepEqual(postListing([fa, en, other], "en"), [en, other]);
  assert.deepEqual(postListing([fa, en, other], "fa"), [fa, other]);
  assert.deepEqual(postListing([en], "fa"), [en]);
  assert.equal(
    postListing([{ ...other, publishedAt: "2026-02-01" }, en], "en")[0].slug,
    "other",
  );
});
