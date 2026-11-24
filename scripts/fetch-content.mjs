import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizePosts, PROJECT_ID, DATASET } from "./content-core.mjs";
const project = process.env.SANITY_PROJECT_ID || PROJECT_ID;
const dataset = process.env.SANITY_DATASET || DATASET;
if (!/^[a-z0-9]+$/.test(project) || !/^[a-z0-9_-]+$/.test(dataset))
  throw new Error("Invalid Sanity project or dataset identifier.");
const query = `*[_type == "post" && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now()) && !(_id in path("drafts.**"))] | order(publishedAt desc) {_id,title,"slug":slug.current,language,excerpt,publishedAt,_updatedAt,featured,tags,seoTitle,seoDescription,"translation":translation->{language,"slug":slug.current},"category":category->{titleFa,titleEn,"slug":slug.current},"cover":cover{alt,caption,"url":asset->url},body[]{...,"asset":asset->{url,metadata{dimensions}}}}`;
let result;
if (process.env.BLOG_CONTENT_FILE) {
  if (process.env.GITHUB_ACTIONS)
    throw new Error("Fixture content is forbidden in publishing workflows.");
  result = JSON.parse(await readFile(process.env.BLOG_CONTENT_FILE, "utf8"));
} else {
  const url = new URL(
    `https://${project}.api.sanity.io/v2026-01-01/data/query/${dataset}`,
  );
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok)
        throw new Error(
          `Sanity returned HTTP ${response.status}. Confirm that the production dataset exists and is public.`,
        );
      const data = await response.json();
      if (data.error) throw new Error("Sanity rejected the content query.");
      result = data.result;
      break;
    } catch (e) {
      error = e;
    }
  }
  if (result === undefined) throw error;
}
const posts = normalizePosts(result);
const target = fileURLToPath(
  new URL("../web/lib/generated/content.json", import.meta.url),
);
await mkdir(fileURLToPath(new URL("../web/lib/generated/", import.meta.url)), {
  recursive: true,
});
await writeFile(target, JSON.stringify({ posts }, null, 2) + "\n");
console.log(
  `Content ready: ${posts.length} published posts from ${project}/${dataset}.`,
);
