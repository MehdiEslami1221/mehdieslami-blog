"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  articlePath,
  dateLabel,
  number,
  categoryLabel,
  type Post,
  type Lang,
} from "@/lib/content";
import { Icon } from "./icons";
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export function Journal({ posts, lang }: { posts: Post[]; lang: Lang }) {
  const fa = lang === "fa",
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const categories = [
    ...new Map(
      posts
        .filter((p) => p.category)
        .map((p) => [
          p.category!.slug,
          { slug: p.category!.slug, title: categoryLabel(p, lang) },
        ]),
    ).values(),
  ];
  const results = useMemo(
    () =>
      posts.filter(
        (p) =>
          (category === "all" || p.category?.slug === category) &&
          normalize(
            [p.title, p.excerpt, ...p.tags, categoryLabel(p, lang)].join(" "),
          ).includes(normalize(query)),
      ),
    [posts, query, category, lang],
  );
  return (
    <>
      {posts.some((post) => post.language !== lang) && (
        <p className="language-note">
          {fa
            ? "نوشته‌ها به زبان اصلی نمایش داده می‌شوند."
            : "Posts are shown in their original language."}
        </p>
      )}
      <div className="journal-toolbar">
        <label className="search-field">
          <Icon name="search" width="18" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={fa ? "جست‌وجو در نوشته‌ها…" : "Search the journal…"}
            aria-label={fa ? "جست‌وجو در نوشته‌ها" : "Search posts"}
            disabled={!posts.length}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={fa ? "پاک‌کردن جست‌وجو" : "Clear search"}
            >
              <Icon name="close" width="16" />
            </button>
          )}
        </label>
        <span className="article-count" aria-live="polite">
          {number(results.length, lang)} {fa ? "نوشته" : "posts"}
        </span>
      </div>
      {categories.length > 0 && (
        <div
          className="category-filters"
          role="group"
          aria-label={fa ? "دسته‌بندی نوشته‌ها" : "Post categories"}
        >
          <button
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            {fa ? "همه" : "All writing"}
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              aria-pressed={category === c.slug}
              onClick={() => setCategory(c.slug)}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
      {results.length ? (
        <div className="posts-grid">
          {results.map((post, i) => (
            <Link
              className={`post-card journal-lit-panel ${i === 0 && !query && category === "all" ? "featured-card" : ""}`}
              href={articlePath(post)}
              key={post._id}
            >
              <span className="journal-reflection" aria-hidden="true" />
              {post.cover ? (
                <div className="post-cover">
                  <img
                    src={post.cover.url + "?w=1100&fit=max&auto=format"}
                    alt={post.cover.alt || ""}
                    loading={i ? "lazy" : "eager"}
                  />
                </div>
              ) : (
                <div className="post-cover code-cover" aria-hidden="true">
                  <span className="cover-category">
                    {post.category?.slug || "notes"}
                  </span>
                  <span className="cover-symbol">
                    {["{ }", "</>", "( )"][i % 3]}
                  </span>
                  <span className="cover-brand">ME / JOURNAL</span>
                </div>
              )}
              <div className="post-info">
                <div className="post-category">
                  <span>{categoryLabel(post, lang)}</span>
                  {post.language !== lang && (
                    <span
                      className="post-language"
                      lang={post.language}
                      dir={post.language === "fa" ? "rtl" : "ltr"}
                    >
                      {post.language === "fa" ? "فارسی" : "English"}
                    </span>
                  )}
                  {i === 0 && !query && category === "all" && (
                    <small>{fa ? "تازه‌ترین" : "LATEST NOTE"}</small>
                  )}
                </div>
                <h3
                  lang={post.language}
                  dir={post.language === "fa" ? "rtl" : "ltr"}
                >
                  {post.title}
                </h3>
                <p
                  lang={post.language}
                  dir={post.language === "fa" ? "rtl" : "ltr"}
                >
                  {post.excerpt}
                </p>
                <div className="post-meta">
                  <time dateTime={post.publishedAt}>
                    {dateLabel(post.publishedAt, lang)}
                  </time>
                  <i />
                  <span>
                    {number(post.readingMinutes, lang)}{" "}
                    {fa ? "دقیقه مطالعه" : "min read"}
                  </span>
                  <Icon name="arrow" width="18" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-journal journal-lit-panel">
          <span className="journal-reflection" aria-hidden="true" />
          <div className="empty-icon">
            <Icon name="book" width="32" height="32" />
          </div>
          <span className="empty-index" dir="ltr">
            {"{ … }"}
          </span>
          <h3>
            {posts.length
              ? fa
                ? "نوشته‌ای پیدا نشد."
                : "No matching notes."
              : fa
                ? "اولین نوشته در راه است."
                : "The first note is on its way."}
          </h3>
          <p>
            {posts.length
              ? fa
                ? "عبارت دیگری را جست‌وجو کنید یا دسته‌بندی را تغییر دهید."
                : "Try another search or choose a different category."
              : fa
                ? "این دفتر تازه باز شده. به‌زودی یادداشت‌هایی از تجربه‌های برنامه‌نویسی را اینجا می‌خوانید."
                : "A new notebook, ready for the first page. Notes on software and the work behind it will appear here."}
          </p>
          {posts.length ? (
            <button
              className="text-action"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              {fa ? "نمایش همهٔ نوشته‌ها" : "Show all writing"}
              <Icon name="arrow" width="16" />
            </button>
          ) : (
            <span className="empty-topics">
              {fa ? "وب · جاوا · اندروید" : "WEB · JAVA · ANDROID"}
            </span>
          )}
        </div>
      )}
    </>
  );
}
