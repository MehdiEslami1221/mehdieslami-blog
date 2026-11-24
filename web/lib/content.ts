import data from "./generated/content.json";
import { postListing } from "./post-list.mjs";
export type Lang = "fa" | "en";
export type Block = {
  _key?: string;
  _type: string;
  style?: string;
  listItem?: string;
  children?: { _type: string; text?: string; marks?: string[] }[];
  markDefs?: { _key: string; _type: string; href?: string }[];
  asset?: { url?: string };
  alt?: string;
  caption?: string;
  code?: string;
  language?: string;
  filename?: string;
};
export type Post = {
  _id: string;
  title: string;
  slug: string;
  language: Lang;
  excerpt: string;
  publishedAt: string;
  _updatedAt?: string;
  featured?: boolean;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  translation?: { language: Lang; slug: string };
  category?: { slug: string; titleFa: string; titleEn: string };
  cover?: { url: string; alt: string; caption?: string };
  body: Block[];
  readingMinutes: number;
};
export const posts = data.posts as Post[];
export const siteURL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://blog.mehdieslami.ir"
).replace(/\/$/, "");
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const asset = (path: string) => `${basePath}${path}`;
export const homePath = (lang: Lang) => (lang === "en" ? "/en/" : "/");
export const articlePath = (post: Pick<Post, "language" | "slug">) =>
  `${post.language === "en" ? "/en" : ""}/posts/${encodeURIComponent(post.slug)}/`;
export const byLanguage = (lang: Lang) =>
  posts.filter((p) => p.language === lang);
export const listedPosts = (lang: Lang) => postListing(posts, lang);
export const dateLabel = (date: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
export const number = (value: number, lang: Lang) =>
  new Intl.NumberFormat(lang).format(value);
export const categoryLabel = (post: Post, lang: Lang) =>
  post.category
    ? lang === "fa"
      ? post.category.titleFa
      : post.category.titleEn
    : lang === "fa"
      ? "یادداشت"
      : "Notes";
export const safeLink = (value?: string) => {
  try {
    const u = new URL(value || "");
    return ["https:", "http:", "mailto:"].includes(u.protocol)
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
};

// Next's export pipeline may supply a percent-encoded Unicode route segment.
export function postBySlug(lang: Lang, segment: string) {
  let slug = segment;
  try {
    slug = decodeURIComponent(segment);
  } catch {
    return undefined;
  }
  return byLanguage(lang).find((post) => post.slug === slug);
}
