# Mehdi Eslami — Journal

A Persian / English software journal, with a Next.js static frontend on GitHub Pages and a separate Sanity Studio. The layout shares the charcoal, lime, monogram, portrait and Persian typography of [mehdieslami.ir](https://mehdieslami.ir/).

- **Sanity project:** `kaaepoyb`
- **Dataset:** `production` (public, published articles only)
- **Intended domain:** `blog.mehdieslami.ir`
- **Stack:** Next.js 16, React 19, TypeScript, Sanity Studio 6

## Local development

Node.js 24 or later is required. There is no application server to maintain in production.

```sh
npm ci
npm run dev
```

The development script downloads the published content once, then starts Next.js. Run `npm run sync` after changing Sanity content during local development. In a second terminal, `npm run studio:dev` starts the editor. Sign in with the Sanity account that owns this project.

```sh
npm run typecheck
npm test
npm run studio:build
npm run build
```

The website export is `web/out/`; the editor build is `studio/dist/`. Content is fetched during the build, so every article has real HTML, metadata, canonical URL and a route that can be opened directly. A failed API request fails the build and leaves the previous deployment in place. An empty dataset produces the welcome page, without sample articles. Search and category filters operate on the exported content in the browser.

## Publish on GitHub Pages

1. In this repository, open **Settings → Pages** and select **GitHub Actions** as the source if Pages has not already been enabled by the workflow.
2. Run **Actions → Publish blog → Run workflow**. The workflow also runs on pushes to `main`, Sanity dispatch events and an hourly fallback schedule.
3. Check the deployment URL in the workflow summary. The initial project URL may inherit the portfolio's custom domain.
4. When ready, set **Custom domain** in Pages to `blog.mehdieslami.ir`, then create the Cloudflare `blog` CNAME pointing to `MehdiEslami1221.github.io`. Use **DNS only** for the initial GitHub verification and certificate issuance. Leave the existing root-domain records unchanged. Enable **Enforce HTTPS** once available.
5. Run **Publish blog** again after changing the domain. It uses the URL and base path returned by GitHub Pages automatically; no manual path replacements are needed.

The DNS record alone does not configure the GitHub domain. Verify the domain in GitHub before adding the record. GitHub's Pages and Actions service limits still apply.

## Deploy the editing panel

The editor must be deployed once before the owner can write articles from a phone. Its source is already configured for this project. The intended hostname `mehdi-eslami-blog.sanity.studio` is confirmed only after a successful deployment.

Choose one method:

**From your computer:**

```sh
npm ci
cd studio
npx sanity login
npm run deploy
```

**From GitHub Actions:** create a Sanity deploy token in the project's management dashboard, save it as the repository Actions secret **SANITY_AUTH_TOKEN**, then run **Deploy Sanity Studio**. Enter the token directly into GitHub Secrets; never commit it or put it in browser code. The workflow does not deploy the editor when the secret is absent. Sanity permissions and hostname availability are checked by the deployment service.

If the hosted editor reports an origin error, add its actual `https://…sanity.studio` URL under the project's API/CORS settings, with credentials allowed. The public website reads no authenticated API at runtime.

## Write and publish

Create any categories first, then a **Post**. Choose Persian or English, enter the title, generate a unique slug, write the excerpt and body, and optionally add a cover image, tags, code blocks and SEO text. Cover and inline images require alt text. Publish when ready. The language switch changes the interface/homepage; it does not translate articles automatically. An optional translated-post reference adds reciprocal article language metadata when that other article is also published.

The date field labels the article and filters future dates at build time. It does not enable Sanity's paid scheduled-draft feature. Published articles dated in the future become eligible at the next build after that date. Slugs are public addresses: keep them stable after publishing.

Unpublishing or deleting an article removes its route at the next successful build. Stale article URLs return the static 404 page. The project does not claim that every CMS change is live immediately.

## Update the website after publication

Without a webhook, the hourly workflow is the fallback and manual workflow runs are available. GitHub schedules may be delayed and are disabled on inactive public repositories after 60 days. For dependable updates tied to publication, configure the webhook described in [docs/PUBLISHING.md](docs/PUBLISHING.md).

Standard Actions runners are free for public repositories; the CMS also has finite free-plan quotas. No paid feature is required by this code. Build credentials are not shipped to visitors.

## Source map

| Location                    | Responsibility                                                   |
| --------------------------- | ---------------------------------------------------------------- |
| `web/app/`                  | Persian and English layouts, homepages and static article routes |
| `web/components/`           | Journal filters, article rendering, navigation and reading tools |
| `web/lib/`                  | Shared types, localized helpers and ignored generated content    |
| `studio/schemaTypes/`       | Post, category, code block and metadata fields                   |
| `scripts/fetch-content.mjs` | Published-content download with bounded retries and validation   |
| `scripts/finish-export.mjs` | Feeds, sitemap, robots and Pages output                          |
| `.github/workflows/`        | Website and optional Studio publishing                           |

`BLOG_SITE_URL` and `BLOG_BASE_PATH` are injected by the Pages workflow. `.env.example` documents the values for a shell or another build system; Node scripts do not automatically load a root `.env` file. The default local build uses the intended custom domain.

## Assets and ownership

The ME monogram, portrait and social cover are the owner's existing portfolio assets. The IRANSansX fonts are owner-supplied commercial fonts, not open-source font files; their applicable license remains the owner's responsibility. No stock image or generated article is represented as an actual project or publication.

See [README.fa.md](README.fa.md) for the Persian guide and [AGENTS.md](AGENTS.md) for maintenance boundaries.

## Original-language posts and portfolio feed

Both journal interfaces show untranslated posts in their original language, with a language label and native text direction. Published linked translations replace duplicate cards in the preferred interface language. The export also writes `latest-posts.json` for the portfolio, containing up to four latest entries per interface, public metadata only. The portfolio reads it after each blog deployment without its own rebuild. RSS remains separated by article language.
