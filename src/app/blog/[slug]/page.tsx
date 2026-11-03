import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { logApiError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await prisma.blogPost.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } }, select: { title: true, excerpt: true, seoTitle: true, seoDescription: true } });
    return post ? { title: post.seoTitle || `${post.title} | N.S. Construction`, description: post.seoDescription || post.excerpt } : { title: "Article | N.S. Construction" };
  } catch (error) {
    logApiError("GET /blog/[slug] metadata", error);
    return { title: "Article | N.S. Construction" };
  }
}

export default async function Article({ params }: Props) {
  const { slug } = await params;
  let post;
  try {
    post = await prisma.blogPost.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } } });
  } catch (error) {
    logApiError("GET /blog/[slug]", error);
    throw new Error("This article is temporarily unavailable.");
  }
  if (!post) notFound();
  return <article className="article-shell">
    <Link className="plain-link" href="/blog">← The journal</Link>
    <div className="section-index">{post.category}{post.publishedAt ? ` / ${new Date(post.publishedAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` : ""}</div>
    <h1>{post.title}</h1>
    <p className="article-lede">{post.excerpt}</p>
    {post.coverImage && <Image className="article-cover" src={post.coverImage} alt="" width={1600} height={900} unoptimized />}
    <div className="article-body">{post.content}</div>
    <Link className="plain-link" href="/blog">← Back to the journal</Link>
  </article>;
}
