# Journal maintenance

This guide describes the project as of 28 November 2026. It covers the deployed reading experience, the editorial workflow and the contracts that other parts of the website depend on. Read the current source before making a change; article content and service settings can change independently of this repository.

Implementation reference: `93e9cde` (binary/editorial atmosphere and shared panel light). Start with [README.md](README.md) for topic guides and [OPERATIONS.fa.md](OPERATIONS.fa.md) for owner operations in Persian. The portfolio's independent [maintenance guide](https://github.com/MehdiEslami1221/MehdiEslami1221.github.io/blob/main/docs/MAINTENANCE.md) covers its time-chip countdown and meteor scene.

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
- Preserve the `prefers-reduced-motion` override and print rules. The notebook uses CSS only. The homepage has a layered binary/editorial field with CSS motion and one client-controlled signal reflected on nearby panels; see SPACE.md.
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
| Homepage decorative field            | `web/components/journal-background.tsx`                           |
| Shared signal and panel light        | `web/components/journal-illumination.tsx`                         |
| Public reaction/comment controls     | `web/components/reactions.tsx`, `web/components/comments.tsx`     |
| Worker API and authentication        | `reactions/worker.mjs`, `reactions/registry.mjs`                   |
| Moderator HTML and client script     | `reactions/admin-page.mjs`                                       |
| D1 schema and migrations              | `reactions/schema.sql`, `scripts/deploy-reactions.mjs`            |
| Shared paths and content types       | `web/lib/content.ts`                                             |
| Validation, escaping and RSS         | `scripts/content-core.mjs`                                       |
| CMS fetch and normalization          | `scripts/fetch-content.mjs`                                      |
| Export verification and public feeds | `scripts/finish-export.mjs`                                      |
| Editor schema                        | `studio/schemaTypes/index.ts`                                    |
| Site deployment                      | `.github/workflows/pages.yml`                                    |
| Editor deployment                    | `.github/workflows/studio.yml`                                   |
| Live API/markup checks               | `scripts/verify-reactions.mjs`                                   |

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

For layout changes, inspect Persian and English at 360px and 1280px. Check direct article URLs, the footer, copy success and clipboard-denied fallback, search/filter/empty states, reading progress and reduced motion. Check homepage signal/reflection alignment in RTL and LTR, nearby versus distant panels, scrolling, and filter/empty-state rerenders without duplicate overlays. Article pages must not mount the homepage light controller.

The implementation baseline passed type checks, 32 tests, Studio and website builds, root/project-path export checks and browser checks in both languages. This is a record of that release, not a claim that every later documentation edit reruns those checks. Current acceptance comes from the checks relevant to the actual change, not a fixed test count. The suite includes content/list selection, real Worker/SQLite behavior, moderation authentication and six jsdom tests of the actual administrator client script. jsdom is test-only, not a website runtime dependency. Test comments/admin sessions belong in disposable local databases, never live demonstration conversations. For Markdown-only changes, review paths, links, contracts and `git diff --check`; no CMS content update or runtime rebuild is required locally.

The website workflow runs on every push to `main`, so a documentation commit can still trigger its normal publication checks. The separate **Deploy Sanity Studio** workflow runs manually or on changes under `studio/**`, `package-lock.json` or its workflow file. Do not redeploy Studio just to publish an ordinary article. Website deployment uses an artifact name unique to run and attempt; preserve matching upload/deploy names when changing workflows.

Temporary content can be supplied using `BLOG_CONTENT_FILE` for local QA. This is deliberately rejected under `GITHUB_ACTIONS`. Never commit generated CMS data, fixture posts or preview HTML into a release. `_empty` is a build-only fallback parameter for empty article collections; the finishing script removes its output directories. It is not an article.

## Service configuration and follow-up checks

- The Pages workflow supplies `BLOG_SITE_URL` and `BLOG_BASE_PATH`. Preserve both custom-domain and project-path support. Root `.env.example` is documentation; Node scripts do not automatically load it.
- On the last live review, the sitemap and robots file still used HTTP URLs inherited from Pages' `base_url`, while the website was accessible over HTTPS. Check Pages' **Enforce HTTPS** setting and rebuild; then verify canonical URLs, feeds, robots and sitemap agree. This has not been recorded as resolved.
- Search Console ownership and sitemap submission are external account settings, not confirmed by the repository. The sitemap is generated automatically on each successful build.
- The Sanity publication webhook remains an optional external setup. Verify actual delivery and a `repository_dispatch` run before describing publication as immediate.
- `SANITY_AUTH_TOKEN` is an Actions secret for Studio deployment. It is not the credential used for the optional Sanity-to-GitHub webhook. Do not read, print or commit either credential. A workflow that skips deployment for a missing token is not proof that a new Studio version was published.
- Keep API failures fatal, normalize absent optional Sanity fields, reject duplicate locale/slug pairs and preserve validation of article paths, links and image hosts. Continue rendering Portable Text through React rather than injecting arbitrary CMS HTML.

## Features outside the current scope

Visitor accounts, a custom publishing dashboard and automatic translation are not implemented. Anonymous discussions are described in [COMMENTS.md](COMMENTS.md). Sanity remains the editing interface.

Article likes/dislikes are implemented in the separate Worker/D1 service described in [REACTIONS.md](REACTIONS.md). The publishing workflow updates its article registry and exports the verified API URL to the static frontend build. Preserve shared translation totals, stable document IDs and neutral tombstones. Browser storage is an anonymous convenience identifier, not proof of a unique person. There is no continuous realtime polling.

## Discussion data and owner access

Public comments, one-level replies and reactions share `mehdieslami-blog-reactions`, the existing Cloudflare Worker/D1 service. The current dashboard is `https://mehdieslami-blog-reactions.p30lod.workers.dev/admin/`. It uses server-side authentication, eight-hour secure sessions and exact-origin/CSRF checks; it is not a static password gate. Keep private pending text out of public APIs, exported HTML and browser bundles. New and legacy comments without a moderation state default to pending. An approved reply also requires an approved, non-deleted root; rejecting/removing a root hides its thread. Administrator removal is recoverable moderation state; author deletion blanks the body permanently.

`settings` retains the private registry/signing key and administrator verifier; `votes` and `rate_limits` retain reaction/write state. `comments` stores discussion records, `comment_moderation` stores review state, and `admin_sessions` stores hashed session identifiers with CSRF/expiry. Preserve these tables and the existing signing key across releases. Deployment hashes and uploads both Worker modules (`worker.mjs`, `admin-page.mjs`); updating only one would leave the public/API and moderator client inconsistent.

The dashboard inherits IRANSansX from the public journal font paths; keep the font CORS and CSP rules aligned. It locks controls during requests, refreshes stale CSRF state once after a changed session cookie, and distinguishes a saved decision from a failed list refresh. Parent approval is an explicit action, never an automatic side effect of approving a reply. Password rotation revokes all administrator sessions. Normal deployments retain the existing password; first-install bootstrap and controlled recovery are documented in [COMMENTS.md](COMMENTS.md). Do not print credentials, publish private delivery keys or reset D1 for access recovery.

Cloudflare deployment uses the existing `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` Actions secrets. Rotate the token in Cloudflare, update the same repository secret and verify publication before retiring the old token. Its expiry blocks later deployment but does not erase D1 or stop an already-deployed Worker. Sanity deployment and optional GitHub webhook credentials are separate. Free quotas are finite; preserve honest unavailable/rate-limit messages. See [REACTIONS.md](REACTIONS.md) and [COMMENTS.md](COMMENTS.md).

## Accepted journal atmosphere

The homepage uses `journal-background.tsx`: six masked binary streams, twelve small code fragments, three editorial outlines, two faint watermarks and eighteen data points, with a faint lime/teal wash. Smaller screens reduce density. CSS transform/opacity animations supply the base motion. `journal-illumination.tsx` moves one shared signal on a 48-second path and updates React-owned `.journal-reflection` overlays, using cached viewport bounds and capped 24 Hz desktop / 18 Hz mobile writes. The field's bounding rectangle converts local positions to viewport coordinates, including RTL scrollbars; resizing a mobile halo must not scale its translation.

Keep the one-pixel rim/local fill faint and proximity-based. Observers invalidate bounds when filtered cards/layout change; the controller must not inject DOM children or observe its own style writes. Hidden tabs and reduced motion stop/clear the light. Print hides decoration. Articles retain their separate ambient layer and normal-flow share/footer layout. Former Canvas, black-hole, circuit and meteor backgrounds are retired in this repository. Do not restore them or replace the portfolio's independently maintained scene. See [SPACE.md](SPACE.md).

## Safe update and rollback

Start from the latest `main` and keep changes within the requested feature. Review source and lockfile changes, preserve public routes and the version-1 portfolio feed, and run the relevant checks above. Do not edit ignored CMS snapshots or `web/out/` as source. Static frontend rollback can use a reviewed revert and the normal publication workflow; a rebuild still reads current eligible Sanity content. A code revert does not rewind CMS documents, D1 votes/comments or private settings. Database migrations therefore need compatibility review before deployment rather than an assumption that reverting HTML undoes stored data. Keep account-setting observations separate from verified repository behavior.
