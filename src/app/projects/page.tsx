import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { logApiError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Projects | N.S. Construction", description: "Published N.S. Construction project case studies and verified project photography." };

export default async function ProjectsPage() {
  let items: Awaited<ReturnType<typeof prisma.project.findMany>> = [];
  let unavailable = false;
  try {
    items = await prisma.project.findMany({ where: { published: true }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }] });
  } catch (error) {
    logApiError("GET /projects", error);
    unavailable = true;
  }
  return <main className="subpage"><div className="site-container">
    <Link className="plain-link" href="/">← N.S. Construction</Link>
    <div className="subpage-heading"><span className="section-index">PROJECT PORTFOLIO / LUCKNOW</span><h1>Built work.<br />Thoughtful stories.</h1><p>Case studies are published only after company project details and images have been reviewed.</p></div>
    {unavailable ? <div className="empty-state" role="status"><p>The project archive is temporarily unavailable. Please try again later.</p><Link className="btn" href="/projects">Retry ↗</Link></div> : items.length === 0 ? <div className="empty-state">Verified project case studies and company photography are being prepared for publication.</div> :
      <div className="archive-grid">{items.map((project) => <Link className="archive-card" href={`/projects/${project.slug}`} key={project.id}>
        <div className="archive-card-image">{project.coverImage ? <Image src={project.coverImage} alt={project.title} fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized /> : null}</div>
        <div className="archive-card-body"><span>{project.category} · {project.location}{project.year ? ` · ${project.year}` : ""}</span><h2>{project.title}</h2><p>{project.summary}</p><span>VIEW CASE STUDY ↗</span></div>
      </Link>)}</div>}
  </div></main>;
}
