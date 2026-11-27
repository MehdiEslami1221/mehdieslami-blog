# Article reactions

The reading website remains a GitHub Pages static export. Reactions use a small Cloudflare Worker and a D1 database, deployed by the existing **Publish blog** workflow.

## Behavior

- The article ends with “Was this post useful?” / «این نوشته برایتان مفید بود؟», two thumb buttons and real like/dislike totals.
- No sign-in is required. One random browser identifier is stored under `mehdi-blog-voter-v1` in localStorage.
- Selecting the active option again sends a neutral vote (`0`); selecting the other changes the vote.
- Linked published translations share totals and the visitor's selected option. A reference in either direction is sufficient.
- Counts are loaded on a page visit, after a vote, on a later window focus and after another tab changes a vote. There is no continuous polling or WebSocket connection.
- Loading shows dashes, not invented zeros. Requests have a timeout; network errors and quota exhaustion show a retry message. Successful counts replace the display only after a confirmed API response.
- The layout uses normal article flow and does not overlap the copy-link action or footer. The buttons expose `aria-pressed`, and status messages use a live region.

Browser storage is a convenience identifier, not proof of identity. Clearing it, using a different browser or device, or deliberately fabricating identifiers can permit additional votes. Do not describe this as one verified person per vote.

## Deployment

Set these repository Actions secrets:

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account that owns the Worker and database |
| `CLOUDFLARE_API_TOKEN` | Account-scoped Workers Scripts Edit and D1 Edit access |

Complete free Workers onboarding once so the account has a `workers.dev` subdomain. No DNS write permission, paid plan, new Sanity token or custom voting domain is required.

After tests and Studio build, `scripts/deploy-reactions.mjs`:

1. Finds or creates the D1 database `mehdieslami-blog-reactions`.
2. Verifies the project ownership marker before reusing a database.
3. Applies the idempotent SQL schema and atomically refreshes the published article registry from the same CMS snapshot used for the site build.
4. Retains a private random signing key in D1 settings and exposes it only as a secret Worker binding.
5. Uploads `reactions/worker.mjs` when its revision changes; it refuses to overwrite a Worker bound to a different database.
6. Enables the Worker's account-owned `workers.dev` URL and checks health, revision and an actual D1 read.
7. On a changed implementation, checks like/repeat/dislike/removal with a temporary identifier and removes the test record before publishing the website.
8. Returns a public URL through the step output. Next.js compiles only this URL into `NEXT_PUBLIC_REACTIONS_URL`.

The Actions summary contains the verified API URL. The Cloudflare API token and account ID are not compiled into the browser. No value from the repository Secrets needs to be retrieved manually.

The publishing workflow downloads Sanity content once, before validation. It then builds the web workspace directly and runs the finishing script, so the site and reaction registry use that same snapshot.

Cloudflare credentials expiring or being removed stops subsequent deployments; it does not erase votes. Existing Worker deployments keep serving independently of the deployment token. Resolve access before retrying a failed publication. Worker and D1 Free plans have finite quotas; the application does not require upgrading them.

For a local frontend preview, set `BLOG_REACTIONS_URL` to an explicitly selected development API; when absent, the reaction component is omitted. Production origin restrictions deliberately exclude localhost. Do not add localhost to the live Worker just for a preview, and do not cast test votes against real posts without restoring them.

## Data model

| Table | Responsibility |
| --- | --- |
| `settings` | Ownership marker, published translation registry, signing key and deployed revision |
| `votes` | Native Sanity document ID, hashed browser identifier, vote and monotonic sequence |
| `rate_limits` | Hashed network identifier, minute window and write count |

Vote records are attached to immutable document IDs, not slugs. Each document/browser pair has a unique constraint. Replacing a vote allocates a newer sequence. Totals and the selected option use the latest row per browser across the currently linked published documents, so linking two previously voted articles does not double-count a visitor.

Neutral votes are retained as tombstones. Deleting only one language's vote would otherwise allow the other language's older vote to reappear. Do not remove that behavior in a cleanup. Unpublishing removes a document from the active registry; it does not permanently delete its stored votes. Republishing or changing translation links recalculates which documents share totals.

Groups must have at most one published article per language. Conflicting chains fail deployment rather than combining unrelated articles silently.

## API and safeguards

| Endpoint | Behavior |
| --- | --- |
| `GET /health` | Version and deployed revision, with no private data |
| `GET /v1/reactions?post=<document-id>` | Shared counts and, with `X-Voter-ID`, this browser's selection |
| `POST /v1/reactions` | JSON `{postId, vote}`, where vote is `1`, `-1` or `0` |
| `OPTIONS /v1/reactions` | CORS preflight for the blog origins |

Browser identifiers must be 64 lowercase hex characters generated with the browser's cryptographic random generator. The server stores only an HMAC, not the original browser token. The trusted platform network address is also HMAC-hashed for rate limiting; raw IP addresses are not written to D1.

Writes are limited to 20 per minute per network address. This is abuse friction, not authentication; visitors sharing a network share that allowance. Old limit rows are cleaned during publication. Reads do not consume this write allowance. Aggregation uses the article index, but high traffic or many votes can still reach the free read quota.

The allowed origins are the HTTPS blog origin and its existing HTTP counterpart. CORS controls browser access; it does not prevent a non-browser client from spoofing an Origin header. The API also rejects unknown/draft post IDs, invalid votes and methods, and bodies over 1 KB. SQL values use bound parameters. Error responses expose neither database details nor credentials. Personalized responses are not cached.

Never add reaction totals to structured data as review scores or manufacture initial likes.

## Checks

`tests/reactions.test.mjs` runs the actual Worker handler and SQL against Node 24's built-in SQLite adapter. It covers translation grouping, idempotent and concurrent repeat requests, switching/removing votes, linking already-voted translations, input/origin rejection, failure states and rate limiting. The normal content and post-list tests still run.

For UI changes, inspect the article end in both languages at 360px and 1280px, keyboard focus, selected states, disabled requests, error/retry and unavailable browser storage. Keep the copy-link layout intact.

Anonymous comments and replies now share this Worker/database; see [COMMENTS.md](COMMENTS.md). Visitor accounts, automatic translation and a custom publishing dashboard remain outside the implementation.

After Pages deployment, `scripts/verify-reactions.mjs` checks live article HTML in each available language, preserved copy-link controls, the compiled public API endpoint and Worker health. These are HTTP checks; they do not replace visual browser QA.
