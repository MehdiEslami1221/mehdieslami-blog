import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { rss, postPath, escapeXML } from "./content-core.mjs";
import { postListing } from "../web/lib/post-list.mjs";
for (const path of ["web/out/posts/_empty", "web/out/en/posts/_empty"])
  await rm(path, { recursive: true, force: true });
const { posts } = JSON.parse(
  await readFile("web/lib/generated/content.json", "utf8"),
);
const base = (
  process.env.BLOG_SITE_URL || "https://blog.mehdieslami.ir"
).replace(/\/$/, "");
const url = new URL(base);
if (!["https:", "http:"].includes(url.protocol))
  throw new Error("Invalid site URL.");
for (const lang of ["fa", "en"]) {
  const dir = lang === "en" ? "web/out/en" : "web/out";
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/feed.xml`, rss(posts, base, lang));
}
// A successful framework build can still emit a not-found shell for a bad route.
// Check the exported article itself before allowing deployment.
for (const post of posts) {
  const path = `${post.language === "en" ? "en/" : ""}posts/${post.slug}/index.html`;
  const html = await readFile(`web/out/${path}`, "utf8");
  const schemas = [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs),
  ].map((match) => JSON.parse(match[1]));
  if (
    !schemas.some(
      (schema) =>
        schema["@type"] === "BlogPosting" && schema.headline === post.title,
    )
  )
    throw new Error(`Article was not exported correctly: ${path}`);
}
const urls = [
  { path: "/" },
  { path: "/en/" },
  ...posts.map((p) => ({
    path: postPath(p),
    lastmod: p._updatedAt || p.publishedAt,
  })),
];
await writeFile(
  "web/out/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${escapeXML(base + u.path)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}</url>`).join("")}</urlset>`,
);
await writeFile(
  "web/out/robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`,
);
await writeFile("web/out/.nojekyll", "");
// Small public snapshot for the portfolio; no CMS credentials or article bodies.
const latest = {};
for (const lang of ["fa", "en"]) {
  latest[lang] = postListing(posts, lang)
    .slice(0, 4)
    .map((post) => ({
      id: post._id,
      title: post.title,
      excerpt: post.excerpt,
      language: post.language,
      url: base + postPath(post),
      publishedAt: post.publishedAt,
      readingMinutes: post.readingMinutes,
      category: post.category,
      image: post.cover,
    }));
}
await writeFile(
  "web/out/latest-posts.json",
  JSON.stringify({ version: 1, posts: latest }) + "\n",
);
// A CNAME is emitted only after the owner configures a custom domain.
if (process.env.BLOG_CUSTOM_DOMAIN)
  await writeFile(
    "web/out/CNAME",
    process.env.BLOG_CUSTOM_DOMAIN.trim() + "\n",
  );
console.log(
  `Static export ready at ${base}, with ${posts.length} article routes.`,
);
