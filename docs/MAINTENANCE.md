# Journal maintenance

This guide describes the project as of 25 November 2026. It covers the deployed reading experience, the editorial workflow and the contracts that other parts of the website depend on. Read the current source before making a change; article content and service settings can change independently of this repository.

## Project boundaries

| Item              | Location or purpose                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Blog source       | [MehdiEslami1221/mehdieslami-blog](https://github.com/MehdiEslami1221/mehdieslami-blog)                   |
| Persian homepage  | `https://blog.mehdieslami.ir/`                                                                            |
| English homepage  | `https://blog.mehdieslami.ir/en/`                                                                         |
| Editor            | `https://mehdi-eslami-blog.sanity.studio/`                                                                |
| Sanity content    | Project `kaaepoyb`, public dataset `production`                                                           |
| Portfolio source  | [MehdiEslami1221/MehdiEslami1221.github.io](https://github.com/MehdiEslami1221/MehdiEslami1221.github.io) |
| Portfolio website | `https://mehdieslami.ir/` and `/fa/`                                                                      |

The blog and portfolio are separate repositories and deployments. Blog maintenance should not replace the portfolio homepage or modify its root-domain DNS records. The reading site stays a GitHub Pages static export. Article reactions call an independent Cloudflare Worker/D1 API. Sanity Studio is deployed separately to Sanity hosting.

Current package versions are Next.js 16.4.6, React 19.3.1, TypeScript 7.0.2 and Sanity 6.24.0. Node.js 24 or later is required. Check the package manifests and lockfile when updating dependencies. Before changing Next.js behavior, read the installed version's documentation under `node_modules/next/dist/docs/`.

## Content flow

1. An editor publishes a post or category in Sanity Studio.
2. The **Publish blog** workflow checks out the source and downloads eligible published content.
3. `scripts/fetch-content.mjs` validates the response and writes ignored `web/lib/generated/content.json`.
4. Next.js exports the homepages and every article to `web/out/`.
5. `scripts/finish-export.mjs` verifies the exported article schema and writes RSS, sitemap, robots and the portfolio snapshot.
6. GitHub Pages replaces the published artifact after a successful build and deployment.

Visitors do not query Sanity to read an article. Content already appears in the exported HTML. A failed fetch or invalid published post must fail the build rather than deploy an empty journal. CMS documents and uploaded images are not stored as editable content in Git.

The workflow runs on pushes to `main`, manual dispatch, the configured hourly schedule and `sanity.publish` repository dispatch events. The dispatch handler being present does not prove that a Sanity webhook has been configured. Webhook delivery has not been verified as part of the current repository setup. See [PUBLISHING.md](PUBLISHING.md) for that optional connection. Schedules can be delayed or disabled after repository inactivity.

## Routes and languages

| Route                | Content                                              |
| -------------------- | ---------------------------------------------------- |
| `/`                  | Persian interface                                    |
| `/en/`               | English interface                                    |
| `/posts/<slug>/`     | Persian article                                      |
| `/en/posts/<slug>/`  | English article                                      |
| `/feed.xml`          | Persian articles only                                |
| `/en/feed.xml`       | English articles only                                |
| `/sitemap.xml`       | Both homepages and eligible published article routes |
| `/latest-posts.json` | Public recent-post metadata for the portfolio        |

Two languages mean two Sanity post documents. Each has its own title, excerpt, body, image description and optional SEO fields. They may reuse the same image asset. Use `translation` to reference the other post, and set it in both directions for reciprocal article alternate-language metadata. Referencing another post does not publish it or translate its text.

`web/lib/post-list.mjs` chooses the homepage cards. A published translation in the interface language replaces the other-language card; without one, the original article remains visible. Deduplication handles a reference in either direction. Foreign-language titles and excerpts retain their original `lang` and `dir`, and a badge identifies their language. Sort order uses `publishedAt`.

The header language switch opens the other homepage. It does not automatically switch to a translated article. Article routes and RSS still use the actual content language; do not generate English article routes for Persian text just to fill a listing.

## Editorial fields

The schema is in `studio/schemaTypes/index.ts`.

| Field            | Current behavior                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `title`          | Required; up to 180 characters                                                                  |
| `language`       | Required; `fa` or `en`                                                                          |
| `slug`           | Required; Unicode letters/numbers separated by hyphens; keep published addresses stable         |
| `excerpt`        | Required in Studio; up to 320 characters                                                        |
| `body`           | Portable Text with paragraphs, h2/h3, quotes, lists, links, inline code, images and code blocks |
| `cover`          | Optional image; alt text required when used; caption optional                                   |
| `category`       | Optional reference; each category has Persian and English names and a slug                      |
| `publishedAt`    | Required; future-dated published posts stay out until the date passes and a build succeeds      |
| `tags`           | Up to eight unique strings                                                                      |
| `translation`    | Optional reference to a post in the other language                                              |
| `seoTitle`       | Optional; up to 70 characters                                                                   |
| `seoDescription` | Optional; up to 170 characters                                                                  |

Use actual h2/h3 styles for section headings so they appear in the article table of contents. Bold paragraphs are not headings. Search covers titles, excerpts, tags and localized category names, not full article bodies. It normalizes common Persian/Arabic letter variants.

The date field is not a paid CMS scheduling feature. Drafts are never included. Unpublishing or deleting a document removes its page at the next successful deployment. Renaming a slug does not create a redirect. There is no fixed article count or hardcoded set of demo posts to maintain.

## Reading experience and visual identity

- Keep the charcoal/lime palette, ME monogram, supplied portrait and local IRANSansX font files. The fonts are owner-supplied commercial assets, not open-source fonts.
- Preserve RTL/LTR layout and the Persian font on Persian text even within the English interface, including the language switch and language badges.
- `home.tsx` renders the notebook illustration as HTML and SVG. `globals.css` animates its rings, orbiting points, code tiles and book using transforms and opacity. It is not a raster image that needs regeneration.
- The page ambience uses a fixed decorative layer behind the content. Keep its contrast low, pointer events off and text readable.
- Preserve the `prefers-reduced-motion` override and print rules. No animation package or JavaScript animation loop is needed for the decorative motion.
- `ReadingTools` owns the scroll progress indicator. `ArticleShare` owns clipboard interaction and its inline status. Both live in `web/components/reading-tools.tsx`.
- The copy-link button belongs inside `.article-actions` at the end of the article, beside the return link. It must not be fixed over the site footer. If clipboard permission is unavailable, display the URL in the same area without overflow.
- Reading time is an estimate derived from article text, not a recorded visitor statistic. The table of contents is generated from h2/h3 blocks.

## Portfolio feed contract

The portfolio shows up to four recent posts after the work section and before the about section, in both homepage languages. Its implementation is in the portfolio repository's `blog.js`, `blog-feed.mjs`, `blog.css`, `app.js`, `index.html` and generated `fa/index.html`.

The blog exports this shape:

```ts
type RecentFeed = {
  version: 1;
  posts: {
    fa: RecentPost[];
    en: RecentPost[];
  };
};
type RecentPost = {
  id: string;
  title: string;
  excerpt: string;
  language: "fa" | "en";
  url: string;
  publishedAt: string;
  readingMinutes: number;
  category?: { slug: string; titleFa: string; titleEn: string };
  image?: { url: string; alt: string; caption?: string };
};
```

Each list has at most four entries and follows the same translation selection as its blog interface. An article URL always points to the original published route. The snapshot contains no article body or credentials. Do not rename `image` to `cover`, change the version or change the endpoint without updating the consumer.

On a page visit, the portfolio fetches the snapshot once, validates it and renders text through DOM text properties. It preserves original-language typography, uses HTTPS article links and accepts cover images only from Sanity's image CDN. Loading, empty, retry and error states are provided; a normal link to the blog remains available. A new blog deployment updates this data without rebuilding the portfolio. A page already open is not continuously polled for new posts.

## Files to check before an edit

| Area                                 | Files                                                            |
| ------------------------------------ | ---------------------------------------------------------------- |
| Localized layouts and routes         | `web/app/(fa)/`, `web/app/(en)/`, `web/app/global-not-found.tsx` |
| Homepage and notebook                | `web/components/home.tsx`                                        |
| Search, categories and cards         | `web/components/journal.tsx`, `web/lib/post-list.mjs`            |
| Article, Portable Text and metadata  | `web/components/article.tsx`                                     |
| Header, footer and font registration | `web/components/shell.tsx`                                       |
| Progress and sharing                 | `web/components/reading-tools.tsx`                               |
| Visual styles and motion             | `web/app/globals.css`                                            |
| Shared paths and content types       | `web/lib/content.ts`                                             |
| Validation, escaping and RSS         | `scripts/content-core.mjs`                                       |
| CMS fetch and normalization          | `scripts/fetch-content.mjs`                                      |
| Export verification and public feeds | `scripts/finish-export.mjs`                                      |
| Editor schema                        | `studio/schemaTypes/index.ts`                                    |
| Site deployment                      | `.github/workflows/pages.yml`                                    |
| Editor deployment                    | `.github/workflows/studio.yml`                                   |

## Validation and deployment

Run the relevant checks from the repository root:

```sh
npm ci
npm run sync
npm run typecheck
npm test
npm run studio:build
npm run build
git diff --check
```

Use `npm ci` when dependencies are absent or changed. Website output is `web/out/`; Studio output is `studio/dist/`. Building Studio does not deploy it. Redeploy Studio after schema/configuration changes, not after ordinary article edits. Keep `package-lock.json` with intentional dependency updates.

For layout changes, inspect Persian and English at 360px and 1280px. Check direct article URLs, the footer, copy success and clipboard-denied fallback, search/filter/empty states, reading progress and reduced motion. The last layout release passed the type checks, eight content/listing tests, both builds and browser checks in both languages. An empty-content export under a project base path was also checked before restoring production content.

Temporary content can be supplied using `BLOG_CONTENT_FILE` for local QA. This is deliberately rejected under `GITHUB_ACTIONS`. Never commit generated CMS data, fixture posts or preview HTML into a release. `_empty` is a build-only fallback parameter for empty article collections; the finishing script removes its output directories. It is not an article.

## Service configuration and follow-up checks

- The Pages workflow supplies `BLOG_SITE_URL` and `BLOG_BASE_PATH`. Preserve both custom-domain and project-path support. Root `.env.example` is documentation; Node scripts do not automatically load it.
- On the last live review, the sitemap and robots file still used HTTP URLs inherited from Pages' `base_url`, while the website was accessible over HTTPS. Check Pages' **Enforce HTTPS** setting and rebuild; then verify canonical URLs, feeds, robots and sitemap agree. This has not been recorded as resolved.
- Search Console ownership and sitemap submission are external account settings, not confirmed by the repository. The sitemap is generated automatically on each successful build.
- The Sanity publication webhook remains an optional external setup. Verify actual delivery and a `repository_dispatch` run before describing publication as immediate.
- `SANITY_AUTH_TOKEN` is an Actions secret for Studio deployment. It is not the credential used for the optional Sanity-to-GitHub webhook. Do not read, print or commit either credential. A workflow that skips deployment for a missing token is not proof that a new Studio version was published.
- Keep API failures fatal, normalize absent optional Sanity fields, reject duplicate locale/slug pairs and preserve validation of article paths, links and image hosts. Continue rendering Portable Text through React rather than injecting arbitrary CMS HTML.

## Features outside the current scope

Comments, visitor accounts, a custom publishing dashboard and automatic translation are not implemented. Sanity remains the editing interface.

Article likes/dislikes are implemented in the separate Worker/D1 service described in [REACTIONS.md](REACTIONS.md). The publishing workflow updates its article registry and exports the verified API URL to the static frontend build. Preserve shared translation totals, stable document IDs and neutral tombstones. Browser storage is an anonymous convenience identifier, not proof of a unique person. There is no continuous realtime polling.
