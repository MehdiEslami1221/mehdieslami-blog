import { notFound } from "next/navigation";
import { byLanguage, postBySlug } from "@/lib/content";
import { Article, articleMetadata } from "@/components/article";
export const dynamicParams = false;
export function generateStaticParams() {
  const list = byLanguage("en");
  return list.length
    ? list.map((p) => ({ slug: p.slug }))
    : [{ slug: "_empty" }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = postBySlug("en", slug);
  return post ? articleMetadata(post) : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = postBySlug("en", slug);
  if (!post) notFound();
  return <Article post={post} />;
}
