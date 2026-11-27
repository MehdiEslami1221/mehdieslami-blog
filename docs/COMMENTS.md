# Article discussions

The GitHub Pages website remains static. Anonymous comments and replies use the **existing** `mehdieslami-blog-reactions` Cloudflare Worker and D1 database. The same two repository Actions secrets deploy both features; no new account, server, DNS record or paid plan is required.

## Reader experience

- A discussion form appears at the end of every published Persian/English article, after reactions and before the return/share actions.
- Visitors enter a display name and plain-text comment. Names are self-chosen, **not verified identities**. No email, registration or password is collected.
- The browser remembers the editable name in `mehdi-blog-comment-name-v1`. The random browser identifier is shared with reactions (`mehdi-blog-voter-v1`). Clearing storage, private browsing or changing devices loses this convenience and the ability to remove earlier comments.
- If storage is unavailable, the current tab can still comment with an in-memory identifier; the interface explains that the name will not be remembered.
- A root comment accepts replies/discussion. Replies are one level deep to avoid unreadable nesting on mobile. Linked published translations share one discussion, keeping each comment's actual text and direction; nothing is automatically translated.
- The browser can remove its own comments with an inline confirmation. Removal blanks the text/name and leaves a tombstone so replies stay readable. The client cannot impersonate the site owner or remove another browser's comment.
- Comments and replies enter a private review queue after an API-confirmed save. Only approved rows are returned by public root/reply endpoints, in either language. Legacy rows without a moderation record also wait for review. Submission returns a receipt, not a publicly rendered comment. The sender sees a clear waiting-for-review message. The client renders every name/body as escaped React text, never HTML or Markdown. Submitted HTML appears literally; links are not made clickable.
- Network failures preserve the typed draft. A cryptographic request ID deduplicates retries and concurrent requests. Changing the draft starts a new request ID.
- Newest root comments appear first. Pages contain ten roots and at most ten recent replies per root. Earlier-comment and earlier-reply buttons use stable sequence cursors; a refresh updates the conversation without continuous polling.

## API and persistence

| Request | Result |
| --- | --- |
| `GET /v1/comments?post=<Sanity ID>&before=<optional sequence>` | Ten threads, reply previews, next root cursor |
| `GET /v1/comments?post=<ID>&parent=<comment ID>&before=<sequence>` | Ten earlier replies in chronological order and next cursor |
| `POST /v1/comments` | `{postId,id,name,body,language,parentId?,website?}` submits a pending comment |
| `POST /v1/comments` | `{postId,id,action:"delete"}` blanks this browser's own comment |

`id` is 16 cryptographic random bytes encoded as 32 lowercase hex characters. `X-Voter-ID` uses the existing 64-character browser identifier. The database keeps only its HMAC. API responses never expose the original token, stored HMAC, network address or private signing key.

`comments`, `comment_moderation` and `admin_sessions` use additive migrations. Never reset the D1 database or replace its signing key during a deployment: existing votes, names, comments, reply relationships and removal ownership must survive. Native Sanity document IDs anchor discussions, so changing slugs does not lose them. The published registry controls access and current translation membership. Unpublishing makes that document's stored discussion inaccessible; it does not delete data. Changing translation links changes which documents share a discussion, so keep editorial links stable.

Names are bounded to 60 UTF-16 code units and bodies to 2,000; normal Persian half-spaces are retained. Empty/invalid inputs, excessive bodies (>12 KB), directional override controls, draft/unknown articles, unrelated or nested reply parents and unsupported methods are rejected. SQL values use bound parameters.

Comments have a separate write allowance: four creations per browser and eight per network in a ten-minute window. Removals have an independent allowance of the same size. These limits, a hidden honeypot and request validation reduce casual spam; anonymous identifiers and CORS are not proof of identity or protection against a determined bot. Do not describe the service as authenticated or spam-proof. Free Worker/D1 quotas are finite. The API returns honest unavailable/rate-limit messages rather than simulated success.

## Owner moderation

Open the Worker URL shown in the successful **Publish blog** summary and append `/admin/`. The current dashboard is `https://mehdieslami-blog-reactions.p30lod.workers.dev/admin/`.

1. Sign in with the administrator password. The single account is labelled `admin`.
2. Use **در انتظار تأیید** to review new/legacy comments and replies. The article title links to its public page, and replies show their parent context.
3. Choose **تأیید و نمایش**, **رد نظر** or **حذف از نمایش**. A reply can be approved only while its root is approved and not author-deleted. A pending/hidden parent has an explicit **تأیید نظر اصلی** action beside its text; the reply is reviewed separately. Removing/rejecting a root also hides its replies from all public endpoints.
4. Filter by approved/rejected/removed/all to inspect earlier decisions. Removing from display is recoverable: it changes the moderation state and retains the stored text. An author-deleted body cannot be restored by approving it.
5. Use **تغییر رمز عبور** to enter the current password and a new password of 16–256 characters. Successful rotation invalidates every administrator session. Log out on shared devices.

The dashboard is served by the **same Worker**, not by a static password gate. Pending content is never embedded in HTML, bundled into GitHub Pages, or returned by anonymous admin requests. Public articles do not load the dashboard script.

### Authentication and installation

The deployment creates the first random 32-character base64url password in runner memory. It stores only a salted PBKDF2-SHA256 verifier (100,000 iterations) in private D1 settings. It encrypts a delivery envelope with the public RSA-OAEP-SHA256 key in `reactions/admin-bootstrap.pub`; only this ciphertext may appear in Actions logs. The matching private delivery key stays outside the repository. No plaintext password, usable bearer secret or private key belongs in Git, client code or logs.

Bootstrap is **first-install only**. Later deployments retain the password and sessions. The account owner receives the decrypted initial password privately. After password rotation the old delivery envelope is removed. The public bootstrap key cannot sign in or decrypt its envelope.

Sessions use cryptographic random tokens. Only their HMAC is stored in `admin_sessions`; the browser holds an eight-hour host-only `Secure; HttpOnly; SameSite=Strict` cookie. Administrator writes require the exact same origin and a per-session CSRF header. The service rejects cross-origin administration and sends no permissive CORS headers. Login is limited to five attempts per network per 15-minute window. Sessions expire, logout revokes the current session and changing the password revokes all sessions.

Admin HTML, JS and API responses use `no-store`, `noindex`, a restrictive CSP, frame denial and no-referrer headers. User text is inserted with `textContent`. The admin API returns no voter HMACs, raw network identifiers, password verifier or session hashes.

### Password recovery

Prefer changing the password from an authenticated dashboard. If it is lost, recovery requires ownership of the Cloudflare account and a controlled repository deployment. Generate a **new** RSA delivery key pair outside the repository, replace only the public `admin-bootstrap.pub`, and keep the private half private. Then remove only the `admin-password` and `admin-bootstrap-envelope` settings and revoke `admin_sessions` in the D1 console before running the reviewed deployment. Decrypt the new bootstrap envelope locally with that matching private key. Never reset the database, delete `signing-key`, drop `comments` or clear `votes` to recover administrator access. Do not expose settings/session tables in screenshots.

## Verification and maintenance

- `tests/comments.test.mjs` runs the actual Worker handler and SQL with disposable SQLite. It covers approved discussions, translated replies, idempotency, privacy, ownership/removal, tombstones, invalid input/parents, pagination and rate separation from reactions. `tests/moderation.test.mjs` separately checks pending visibility, approvals/removals, direct reply access, session security, origin/CSRF rejection, password rotation, expiry and login limits.
- Browser QA must use a disposable local database for test comments. Never publish demonstration conversations to the live blog.
- The deploy script checks a real discussion read after migration. The Pages verification script checks localized discussion markup/fields alongside reactions, share controls, endpoint wiring and Worker health.
- Preserve names/drafts on recoverable failures, accessible labels/status, focusable reply/removal actions, native `dir="auto"` for text and normal-flow footer layout.

## Dashboard request handling and typography

The dashboard uses the owner's IRANSansX Regular/Bold files from the journal's public `/assets/fonts/` paths. The font host returns CORS permission; the Worker CSP permits fonts only from the journal domain. Form controls inherit that family. No new commercial font files or external font provider are introduced.

While a queue read or moderation request is pending, filters and buttons stay disabled, including newly rendered card actions. A changed cookie after login in another tab can leave a stale CSRF value in memory; on `csrf_required` the client fetches the current authenticated session and retries the same write once. This does not relax origin, cookie, authentication or server CSRF checks. An expired session still requires login.

A successful moderation write and its subsequent list refresh have separate results: if refresh fails, the status says the decision was saved and offers refresh. It must never claim that a confirmed approval failed. Approval of an unpublished article also states that the article is not currently published. `tests/admin-client.test.mjs` uses jsdom as a pinned test-only dependency for loading/lock states, changed-session recovery, parent actions, success-after-refresh-failure and font selection. Worker tests cover the corresponding cookie/CSRF contract.
