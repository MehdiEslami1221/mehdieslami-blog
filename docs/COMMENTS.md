# Article discussions

The GitHub Pages website remains static. Anonymous comments and replies use the **existing** `mehdieslami-blog-reactions` Cloudflare Worker and D1 database. The same two repository Actions secrets deploy both features; no new account, server, DNS record or paid plan is required.

## Reader experience

- A discussion form appears at the end of every published Persian/English article, after reactions and before the return/share actions.
- Visitors enter a display name and plain-text comment. Names are self-chosen, **not verified identities**. No email, registration or password is collected.
- The browser remembers the editable name in `mehdi-blog-comment-name-v1`. The random browser identifier is shared with reactions (`mehdi-blog-voter-v1`). Clearing storage, private browsing or changing devices loses this convenience and the ability to remove earlier comments.
- If storage is unavailable, the current tab can still comment with an in-memory identifier; the interface explains that the name will not be remembered.
- A root comment accepts replies/discussion. Replies are one level deep to avoid unreadable nesting on mobile. Linked published translations share one discussion, keeping each comment's actual text and direction; nothing is automatically translated.
- The browser can remove its own comments with an inline confirmation. Removal blanks the text/name and leaves a tombstone so replies stay readable. The client cannot impersonate the site owner or remove another browser's comment.
- Comments publish immediately after an API-confirmed save. The client renders every name/body as escaped React text, never HTML or Markdown. Submitted HTML appears literally; links are not made clickable.
- Network failures preserve the typed draft. A cryptographic request ID deduplicates retries and concurrent requests. Changing the draft starts a new request ID.
- Newest root comments appear first. Pages contain ten roots and at most ten recent replies per root. Earlier-comment and earlier-reply buttons use stable sequence cursors; a refresh updates the conversation without continuous polling.

## API and persistence

| Request | Result |
| --- | --- |
| `GET /v1/comments?post=<Sanity ID>&before=<optional sequence>` | Ten threads, reply previews, next root cursor |
| `GET /v1/comments?post=<ID>&parent=<comment ID>&before=<sequence>` | Ten earlier replies in chronological order and next cursor |
| `POST /v1/comments` | `{postId,id,name,body,language,parentId?,website?}` creates a comment |
| `POST /v1/comments` | `{postId,id,action:"delete"}` blanks this browser's own comment |

`id` is 16 cryptographic random bytes encoded as 32 lowercase hex characters. `X-Voter-ID` uses the existing 64-character browser identifier. The database keeps only its HMAC. API responses never expose the original token, stored HMAC, network address or private signing key.

`comments` is an additive migration. Never reset the D1 database or replace its signing key during a deployment: existing votes, names, comments, reply relationships and removal ownership must survive. Native Sanity document IDs anchor discussions, so changing slugs does not lose them. The published registry controls access and current translation membership. Unpublishing makes that document's stored discussion inaccessible; it does not delete data. Changing translation links changes which documents share a discussion, so keep editorial links stable.

Names are bounded to 60 UTF-16 code units and bodies to 2,000; normal Persian half-spaces are retained. Empty/invalid inputs, excessive bodies (>12 KB), directional override controls, draft/unknown articles, unrelated or nested reply parents and unsupported methods are rejected. SQL values use bound parameters.

Comments have a separate write allowance: four creations per browser and eight per network in a ten-minute window. Removals have an independent allowance of the same size. These limits, a hidden honeypot and request validation reduce casual spam; anonymous identifiers and CORS are not proof of identity or protection against a determined bot. Do not describe the service as authenticated or spam-proof. Free Worker/D1 quotas are finite. The API returns honest unavailable/rate-limit messages rather than simulated success.

## Owner moderation

The owner can remove abusive text directly in **Cloudflare → Workers & Pages → D1 → mehdieslami-blog-reactions → Console**. There is no public administration endpoint and no secret shipped to visitors.

Review recent comments first:

```sql
SELECT id, post_id, parent_id, name, body, created_at, deleted
FROM comments ORDER BY seq DESC LIMIT 100;
```

After identifying the exact unwanted comment ID, blank that row while preserving replies:

```sql
UPDATE comments SET deleted=1, name='', body=''
WHERE id='EXACT_COMMENT_ID';
```

This action removes the public text. Review the selected ID and keep an authorized export if recovery is needed before changing records. Do not delete all comments, drop tables or expose `settings`/private hashes in screenshots. For sustained spam, temporarily disable new comment creation in the Worker while retaining reads; a future moderation queue/Turnstile integration is a separate change.

## Verification and maintenance

- `tests/comments.test.mjs` runs the actual Worker handler and SQL with disposable SQLite. It covers publishing, translated replies, idempotency, privacy, ownership/removal, tombstones, invalid input/parents, pagination and rate separation from reactions.
- Browser QA must use a disposable local database for test comments. Never publish demonstration conversations to the live blog.
- The deploy script checks a real discussion read after migration. The Pages verification script checks localized discussion markup/fields alongside reactions, share controls, endpoint wiring and Worker health.
- Preserve names/drafts on recoverable failures, accessible labels/status, focusable reply/removal actions, native `dir="auto"` for text and normal-flow footer layout.
