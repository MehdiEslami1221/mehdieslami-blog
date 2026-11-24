import Link from "next/link";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "@portabletext/types";
import type { Metadata } from "next";
import {
  articlePath,
  asset,
  siteURL,
  homePath,
  dateLabel,
  number,
  categoryLabel,
  safeLink,
  posts,
  type Post,
  type Lang,
} from "@/lib/content";
import { Icon } from "./icons";
import { ArticleShare, ReadingTools } from "./reading-tools";
const components: PortableTextComponents = {
  block: {
    h2: ({ children, value }) => (
      <h2 id={`section-${value._key}`}>{children}</h2>
    ),
    h3: ({ children, value }) => (
      <h3 id={`section-${value._key}`}>{children}</h3>
    ),
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  },
  marks: {
    link: ({ children, value }) => {
      const href = safeLink(value?.href);
      return href ? (
        <a href={href} rel="noopener noreferrer">
          {children}
        </a>
      ) : (
        <span>{children}</span>
      );
    },
  },
  types: {
    image: ({ value }) => {
      let valid = false;
      try {
        const u = new URL(value.asset?.url);
        valid = u.protocol === "https:" && u.hostname === "cdn.sanity.io";
      } catch {}
      return valid ? (
        <figure>
          <img
            src={value.asset.url + "?w=1500&fit=max&auto=format"}
            alt={value.alt || ""}
            loading="lazy"
          />
          {value.caption && <figcaption>{value.caption}</figcaption>}
        </figure>
      ) : null;
    },
    codeBlock: ({ value }) => (
      <div className="code-block" dir="ltr">
        <div>
          <span>{value.filename || value.language || "code"}</span>
        </div>
        <pre>
          <code>{value.code}</code>
        </pre>
      </div>
    ),
  },
};
export function articleMetadata(post: Post): Metadata {
  const url = siteURL + articlePath(post);
  const alternates: Record<string, string> = { [post.language]: url };
  const translated =
    post.translation &&
    posts.find(
      (p) =>
        p.language === post.translation!.language &&
        p.slug === post.translation!.slug,
    );
  if (translated)
    alternates[translated.language] = siteURL + articlePath(translated);
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: url, languages: alternates },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
      modifiedTime: post._updatedAt,
      authors: ["https://mehdieslami.ir/"],
      locale: post.language === "fa" ? "fa_IR" : "en_GB",
      images: post.cover
        ? [{ url: post.cover.url, alt: post.cover.alt }]
        : [{ url: siteURL + "/assets/social-cover.webp" }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.cover?.url || siteURL + "/assets/social-cover.webp"],
    },
  };
}
export function Article({ post }: { post: Post }) {
  const lang = post.language,
    fa = lang === "fa";
  const headings = post.body
    .filter((b) => b._type === "block" && ["h2", "h3"].includes(b.style || ""))
    .map((b) => ({
      id: `section-${b._key}`,
      title: (b.children || []).map((c) => c.text || "").join(""),
      level: b.style,
    }));
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post._updatedAt || post.publishedAt,
    inLanguage: lang,
    mainEntityOfPage: siteURL + articlePath(post),
    author: {
      "@type": "Person",
      "@id": "https://mehdieslami.ir/#me",
      name: "Mehdi Eslami",
      url: "https://mehdieslami.ir/",
    },
    ...(post.cover ? { image: post.cover.url } : {}),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <ReadingTools />
      <article className="article wrap">
        <div className="article-breadcrumb">
          <Link href={homePath(lang)}>{fa ? "نوشته‌ها" : "Journal"}</Link>
          <span>/</span>
          <span>{categoryLabel(post, lang)}</span>
        </div>
        <header className="article-header">
          <div className="eyebrow">
            <i />
            {categoryLabel(post, lang)}
          </div>
          <h1>{post.title}</h1>
          <p className="article-excerpt">{post.excerpt}</p>
          <div className="article-byline">
            <img
              src={asset("/assets/portrait.webp")}
              alt=""
              width="44"
              height="44"
            />
            <span>
              {fa ? "مهدی اسلامی" : "Mehdi Eslami"}
              <small>
                <time dateTime={post.publishedAt}>
                  {dateLabel(post.publishedAt, lang)}
                </time>{" "}
                · {number(post.readingMinutes, lang)}{" "}
                {fa ? "دقیقه مطالعه" : "min read"}
              </small>
            </span>
          </div>
        </header>
        {post.cover && (
          <figure className="article-cover">
            <img
              src={post.cover.url + "?w=1800&fit=max&auto=format"}
              alt={post.cover.alt || ""}
            />
            {post.cover.caption && (
              <figcaption>{post.cover.caption}</figcaption>
            )}
          </figure>
        )}
        <div className="article-layout">
          <div className="article-body">
            <PortableText
              value={post.body as PortableTextBlock[]}
              components={components}
            />
            <div className="article-tags">
              {post.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
            <div className="article-end">
              <span>✳</span>
              <p>
                {fa
                  ? "ممنون که تا اینجا خواندید."
                  : "Thanks for reading this far."}
              </p>
              <div className="article-actions">
                <Link href={homePath(lang)}>
                  {fa ? "بازگشت به نوشته‌ها" : "Back to the journal"}
                  <Icon name="arrow" width="18" />
                </Link>
                <ArticleShare lang={lang} />
              </div>
            </div>
          </div>
          <aside className="article-toc">
            {headings.length > 0 && (
              <nav aria-label={fa ? "فهرست این نوشته" : "On this page"}>
                <p className="eyebrow">
                  {fa ? "در این نوشته" : "ON THIS PAGE"}
                </p>
                {headings.map((h) => (
                  <a
                    className={h.level === "h3" ? "subheading" : ""}
                    key={h.id}
                    href={`#${h.id}`}
                  >
                    {h.title}
                  </a>
                ))}
              </nav>
            )}
            <a className="toc-contact" href="https://mehdieslami.ir/#contact">
              {fa ? "دربارهٔ یک پروژه صحبت کنیم" : "Let’s talk about a project"}
              <Icon name="external" width="16" />
            </a>
          </aside>
        </div>
      </article>
    </>
  );
}
