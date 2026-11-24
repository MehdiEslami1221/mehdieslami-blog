# Publication and refresh

The source is a static-export application. Sanity is read once during a build; opening an article never needs a CMS request. A publication webhook starts a new GitHub build. A successful build replaces the whole Pages artifact. A failed build leaves the last successful version intact.

## Connect Sanity to GitHub

This is a one-time owner setup, because it grants access to trigger a repository build.

1. Create a fine-grained GitHub token restricted to **MehdiEslami1221/mehdieslami-blog**, with **Contents: Read and write** for the repository-dispatch endpoint. Give it an expiry and rotate it before expiry. Do not grant access to all repositories.
2. In Sanity Manage, open project `kaaepoyb` → **API → Webhooks** and add a webhook.
3. Set its URL to `https://api.github.com/repos/MehdiEslami1221/mehdieslami-blog/dispatches` and method to **POST**. Enable create, update and delete events. Leave draft events off.
4. Use this GROQ filter:

```groq
_type in ["post", "category"] && !(_id in path("drafts.**"))
```

5. Use this projection, so GitHub receives the required dispatch payload:

```groq
{"event_type": "sanity.publish"}
```

6. Add these HTTP headers in the webhook configuration:

| Header               | Value                                 |
| -------------------- | ------------------------------------- |
| Authorization        | `Bearer YOUR_REPOSITORY_SCOPED_TOKEN` |
| Accept               | `application/vnd.github+json`         |
| Content-Type         | `application/json`                    |
| X-GitHub-Api-Version | `2022-11-28`                          |

The token belongs in Sanity's server-side webhook settings only. It must never enter the blog's browser bundle, article documents, repository files or Studio source. The separate `SANITY_AUTH_TOKEN` Actions secret is for deploying Studio; these credentials are not interchangeable.

7. Publish a test article in Studio, confirm a successful webhook attempt in Sanity's delivery log, then confirm **Publish blog** ran from `repository_dispatch` and deployed the article. Unpublish the test article and verify its route disappears after the next build.

The event payload is only a trigger; the build always re-fetches the published dataset. Deleted or unpublished posts must trigger a build too. Sanity's webhook filter preview should be used to verify all three events; if a provider's delete-event filter differs, use an unfiltered published-document webhook and keep the same minimal projection.

## Fallback behavior

The workflow also runs hourly, on source changes and by manual dispatch. Scheduled runs can be delayed, and GitHub disables scheduled workflows after 60 days without repository activity. Re-enable or use the webhook for ongoing publication. A webhook with an expired token stops triggering builds; inspect the delivery log if a publication does not appear.

Future-dated published posts become eligible only after their date and a successful build. This is not Sanity's scheduled-draft feature. The current generated sitemap includes only published routes and uses actual content dates, not a fake current timestamp for every article.

## Domains and paths

The Pages configuration step provides `base_path` and `base_url`. The build uses these for links, assets, feeds, canonical metadata and the sitemap. The default project URL works before the custom subdomain is connected. After setting a custom domain, re-run the workflow to rebuild for its root path.

Do not change the portfolio's own CNAME or root DNS records when adding this blog. Keep secrets out of workflow logs and preserve the previous successful deployment when content validation fails.
