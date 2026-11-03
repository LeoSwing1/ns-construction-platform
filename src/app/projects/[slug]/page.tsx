import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ImageGallery from "@/components/ImageGallery";
import Image from "next/image";
import Link from "next/link";
import { logApiError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let project;
  try {
    project = await prisma.project.findFirst({ where: { slug, published: true } });
  } catch (error) {
    logApiError("GET /projects/[slug]", error);
    throw new Error("Project case study is temporarily unavailable.");
  }
  if (!project) notFound();

  const images = [project.coverImage, ...project.gallery].filter((image): image is string => Boolean(image));
  return <main className="article-shell">
    <Link className="plain-link" href="/projects">← All case studies</Link>
    <div className="section-index">{project.category} / {project.location}{project.year ? ` / ${project.year}` : ""}</div>
    <h1>{project.title}</h1>
    <p className="article-lede">{project.summary}</p>
    {project.coverImage && <Image className="article-cover" src={project.coverImage} alt={project.title} width={1600} height={900} unoptimized />}
    <div className="article-body">{project.description}</div>
    {images.length > 1 && <ImageGallery title={project.title} images={images.slice(1).map((src) => ({ src, alt: `${project.title} project photograph` }))} />}
    <p className="form-note">Project details and photography provided for this published case study.</p>
    <Link className="btn" href="/#contact">Discuss a similar project ↗</Link>
  </main>;
}
