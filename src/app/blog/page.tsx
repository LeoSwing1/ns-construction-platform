import { prisma } from "@/lib/prisma";
import { logApiError } from "@/lib/api-errors";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Journal | N.S. Construction", description: "Construction planning, material and project delivery insights from N.S. Construction." };

export default async function BlogPage() {
  let posts: Awaited<ReturnType<typeof prisma.blogPost.findMany>> = [];
  let unavailable = false;
  try {
    posts = await prisma.blogPost.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" } });
  } catch (error) {
    logApiError("GET /blog", error);
    unavailable = true;
  }
  return <main className="subpage"><div className="site-container">
    <Link className="plain-link" href="/">← N.S. Construction</Link>
    <div className="subpage-heading"><span className="section-index">THE JOURNAL / NOTES ON BUILDING</span><h1>Ideas for a<br />better-built future.</h1><p>Practical guidance for making more informed decisions about your construction project.</p></div>
    {unavailable ? <div className="empty-state" role="status">The journal is temporarily unavailable. Please try again later.</div> : posts.length === 0 ? <div className="empty-state">Reviewed construction notes and project guidance will appear here when published.</div> :
      <div className="archive-grid">{posts.map((post) => <article className="archive-card" key={post.id}>
        <Link href={`/blog/${post.slug}`} className="archive-card-image">{post.coverImage ? <Image src={post.coverImage} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized /> : null}</Link>
        <div className="archive-card-body"><span>{post.category} · {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : ""}</span><h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2><p>{post.excerpt}</p><Link href={`/blog/${post.slug}`}>READ ARTICLE ↗</Link></div>
      </article>)}</div>}
  </div></main>;
}
