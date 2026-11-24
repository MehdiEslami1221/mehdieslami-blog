/**
 * Keep untranslated posts discoverable in either interface. When a published
 * translation exists, show the requested language once, even for one-way links.
 * @template {{language: string, slug: string, publishedAt: string, translation?: {language: string, slug: string}}} T
 * @param {T[]} posts
 * @param {string} lang
 * @returns {T[]}
 */
export function postListing(posts, lang) {
  const key = (p) => `${p.language}/${p.slug}`;
  const native = posts.filter((p) => p.language === lang);
  const nativeKeys = new Set(native.map(key));
  const translatedKeys = new Set(
    native.filter((p) => p.translation).map((p) => key(p.translation)),
  );
  return posts
    .filter(
      (p) =>
        p.language === lang ||
        (!translatedKeys.has(key(p)) &&
          !(p.translation && nativeKeys.has(key(p.translation)))),
    )
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
