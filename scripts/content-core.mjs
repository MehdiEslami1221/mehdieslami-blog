export const PROJECT_ID = "kaaepoyb";
export const DATASET = "production";
export function validSlug(value) {
  return (
    typeof value === "string" &&
    value.length <= 120 &&
    /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value) &&
    value.normalize("NFC") === value
  );
}
export function safeLink(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:", "mailto:"].includes(u.protocol)
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function imageURL(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === "cdn.sanity.io"
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function plainText(body = []) {
  return body
    .filter((b) => b._type === "block")
    .map((b) => (b.children || []).map((c) => c.text || "").join(""))
    .join("\n\n");
}
export function readingMinutes(body) {
  return Math.max(
    1,
    Math.ceil(
      plainText(body).trim().split(/\s+/u).filter(Boolean).length / 200,
    ),
  );
}
export function normalizePosts(input, now = Date.now()) {
  if (!Array.isArray(input))
    throw new TypeError("Sanity returned an invalid post collection.");
  const seen = new Set();
  return input
    .filter(
      (p) => !p._id?.startsWith("drafts.") && Date.parse(p.publishedAt) <= now,
    )
    .map((p) => {
      if (
        !p._id ||
        !["fa", "en"].includes(p.language) ||
        !validSlug(p.slug) ||
        typeof p.title !== "string" ||
        !p.title.trim() ||
        !Array.isArray(p.body)
      )
        throw new Error(
          `Invalid published post: ${p._id || "unknown"}. Check title, language, slug and body in Studio.`,
        );
      const key = `${p.language}/${p.slug}`;
      if (seen.has(key)) throw new Error(`Duplicate published slug: ${key}`);
      seen.add(key);
      const category =
        p.category &&
        typeof p.category.titleFa === "string" &&
        typeof p.category.titleEn === "string" &&
        validSlug(p.category.slug)
          ? p.category
          : undefined;
      return {
        ...p,
        title: p.title.trim(),
        excerpt: String(p.excerpt || "").slice(0, 400),
        tags: Array.isArray(p.tags)
          ? p.tags.filter((t) => typeof t === "string").slice(0, 8)
          : [],
        cover:
          p.cover && imageURL(p.cover.url)
            ? { ...p.cover, url: imageURL(p.cover.url) }
            : undefined,
        category,
        readingMinutes: readingMinutes(p.body),
      };
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
export function postPath(post) {
  return `${post.language === "en" ? "/en" : ""}/posts/${encodeURIComponent(post.slug)}/`;
}
export function escapeXML(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );
}
export function rss(posts, siteURL, lang) {
  const base = siteURL.replace(/\/$/, "");
  const items = posts
    .filter((p) => p.language === lang)
    .map(
      (p) =>
        `<item><title>${escapeXML(p.title)}</title><link>${escapeXML(base + postPath(p))}</link><guid isPermaLink="true">${escapeXML(base + postPath(p))}</guid><description>${escapeXML(p.excerpt)}</description><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate></item>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${lang === "fa" ? "نوشته‌های مهدی اسلامی" : "Mehdi Eslami — Journal"}</title><link>${escapeXML(base + (lang === "en" ? "/en/" : "/"))}</link><description>${lang === "fa" ? "یادداشت‌هایی دربارهٔ ساخت نرم‌افزار" : "Notes on building software"}</description><language>${lang}</language>${items}</channel></rss>`;
}
