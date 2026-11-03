import { ArrowDownRight, ArrowUpRight, Check, Compass, DraftingCompass, HardHat, Layers3, Ruler, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { logApiError } from "@/lib/api-errors";
import { getPublicSiteSettings } from "@/lib/site-settings";
import EnquiryForm from "@/components/EnquiryForm";

export const dynamic = "force-dynamic";

const services = [
  { number: "01", icon: Compass, title: "Residential", text: "From a considered family home to a multi-storey residence, bring the brief, plot and priorities to the first conversation.", image: "photo-1600607687939-ce8a6c25118c" },
  { number: "02", icon: Layers3, title: "Commercial", text: "A practical conversation about your commercial build, site requirements, programme and delivery needs.", image: "photo-1486406146926-c627a92ad1ab" },
  { number: "03", icon: HardHat, title: "Civil & structural", text: "Civil works and structural construction planned around the site, drawings and project specification.", image: "photo-1503387762-592deb58ef4e" },
  { number: "04", icon: DraftingCompass, title: "Interiors & finishing", text: "Interior execution, renovation and finishing requirements discussed as part of your overall project.", image: "photo-1600210492486-724fe5c67fb0" },
];

const disciplines = [
  { icon: Ruler, title: "Planning & coordination", detail: "Project brief, site requirements and planning coordination" },
  { icon: DraftingCompass, title: "Drawings & documentation", detail: "Architectural intent, structural drawings and CAD documentation" },
  { icon: Layers3, title: "Structure & execution", detail: "Foundation, RCC and structural work, subject to project scope" },
  { icon: HardHat, title: "Site delivery", detail: "Construction sequencing, materials coordination and finishing" },
];

function photo(id: string, width = 900) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
}

export default async function Home() {
  let projects: { id: string; title: string; slug: string; category: string; location: string; summary: string; coverImage: string | null; year: number | null }[] = [];
  let posts: { id: string; title: string; slug: string; category: string; excerpt: string; coverImage: string | null; publishedAt: Date | null }[] = [];
  let testimonials: { id: string; customerName: string; attribution: string | null; quote: string }[] = [];
  let publishedProjectCount = 0;
  let contentUnavailable = false;
  const settings = await getPublicSiteSettings();
  try {
    [projects, posts, testimonials, publishedProjectCount] = await Promise.all([
      prisma.project.findMany({ where: { published: true }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], take: 3, select: { id: true, title: true, slug: true, category: true, location: true, summary: true, coverImage: true, year: true } }),
      prisma.blogPost.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, take: 3, select: { id: true, title: true, slug: true, category: true, excerpt: true, coverImage: true, publishedAt: true } }),
      prisma.testimonial.findMany({ where: { published: true, verified: true }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, customerName: true, attribution: true, quote: true } }),
      prisma.project.count({ where: { published: true } }),
    ]);
  } catch (error) {
    logApiError("GET / homepage project/blog/testimonial content", error);
    contentUnavailable = true;
  }

  return (
    <>
      <div className="utility-bar"><div className="site-container utility-inner"><span>{settings.location} <i>·</i> Project consultations by appointment</span><a href={`tel:${settings.phoneHref}`}>{settings.phoneDisplay} <ArrowUpRight size={13} /></a></div></div>
      <header className="site-header"><div className="site-container nav-inner">
        <Link className="wordmark" href="/" aria-label="N.S. Construction home"><span className="wordmark-monogram">N<span>.</span>S</span><span className="wordmark-copy">N.S. CONSTRUCTION<small>BUILDING WITH PURPOSE</small></span></Link>
        <nav className="main-nav" aria-label="Main navigation"><a href="#approach">Our approach</a><a href="#services">Capabilities</a><Link href="/projects">Projects</Link><Link href="/blog">Journal</Link><Link href="/quote">Estimate</Link><a href="#contact">Contact</a></nav>
        <details className="mobile-nav"><summary>Menu</summary><div><a href="#approach">Our approach</a><a href="#services">Capabilities</a><Link href="/projects">Projects</Link><Link href="/blog">Journal</Link><Link href="/quote">Estimate</Link><a href="#contact">Contact</a></div></details>
        <Link className="nav-cta" href="/quote">Start an estimate <ArrowUpRight size={15} /></Link>
      </div></header>

      <main>
        <section className="hero-panel">
          <div className="hero-photo" role="img" aria-label="Architectural photography representing contemporary construction" />
          <div className="hero-gradient" />
          <div className="site-container hero-content">
            <div className="hero-kicker"><span /> CONSTRUCTION / CIVIL WORKS / PROJECT DELIVERY</div>
            <h1>Built with clarity.<br /><em>Made to last.</em></h1>
            <p>Thoughtful construction begins with a clear brief, careful planning and people who take the details seriously. Let’s talk about what you’re planning in Lucknow and beyond.</p>
            <div className="hero-actions"><a className="button-light" href="#contact">Discuss your project <ArrowUpRight size={16} /></a><a className="button-ghost" href="#projects">Explore selected work <ArrowDownRight size={16} /></a></div>
            <div className="hero-bottom-note"><span>01 — 04</span><span>Architectural imagery · representative, not a completed N.S. Construction project</span></div>
          </div>
          <div className="hero-side-label">N.S. CONSTRUCTION <span>LUCKNOW · INDIA</span></div>
        </section>

        <section className="fact-strip"><div className="site-container fact-grid">
          <div className="fact-lead"><span className="section-index">01 / THE PRACTICE</span><strong>Good building is<br />a team effort.</strong></div>
          <p>We work with you to understand your site, goals and scope before shaping the next steps. Clear decisions early make for more considered work on site.</p>
          <div className="fact-stat"><strong>{publishedProjectCount > 0 ? String(publishedProjectCount).padStart(2, "0") : "—"}</strong><span>Published case studies<br />in the project archive</span></div>
          <div className="fact-stat"><strong>{settings.location.split(",")[0]}</strong><span>Construction enquiries<br />and project consultations</span></div>
        </div></section>

        <section className="section-block about-section" id="approach"><div className="site-container about-grid">
          <div className="about-heading"><span className="section-index">02 / OUR APPROACH</span><h2>Built around<br /><em>your brief.</em></h2></div>
          <div className="about-copy"><p className="large-copy">Every site is different. Every client has a different idea of home, work and what comes next.</p><p>Our first step is listening. Together we can clarify the requirements, coordinate the right expertise and agree on a practical path forward—without promising what the project cannot support.</p><a className="underlined-link" href="#contact">Tell us what you’re planning <ArrowUpRight size={15} /></a></div>
          <div className="about-image"><Image src={photo("photo-1511818966892-d7d671e672a2", 1400)} alt="Architectural lines and contemporary building materials" fill sizes="(max-width: 760px) 100vw, 80vw" unoptimized /><span>Design begins with a conversation.</span></div>
        </div></section>

        <section className="section-block services-section" id="services"><div className="site-container">
          <div className="section-heading-row"><div><span className="section-index">03 / AREAS OF WORK</span><h2>From the first line<br />to the final finish.</h2></div><p>Tell us which part of your project needs attention. We’ll confirm the available scope and next steps during a consultation.</p></div>
          <div className="service-grid">{services.map((service) => <article className="service-card" key={service.number}>
            <div className="service-image"><Image src={photo(service.image)} alt={`${service.title} construction reference`} fill sizes="(max-width: 760px) 100vw, 25vw" unoptimized /><span className="image-caption">Illustrative image</span><span className="service-icon"><service.icon size={20} /></span></div>
            <div className="service-meta"><span>{service.number} / CAPABILITY</span><span>LUCKNOW</span></div>
            <h3>{service.title}</h3><p>{service.text}</p><a className="card-link" href="#contact">Discuss this scope <ArrowUpRight size={14} /></a>
          </article>)}</div>
        </div></section>

        <section className="engineering-section"><div className="engineering-image"><Image src={photo("photo-1503387762-592deb58ef4e", 1600)} alt="Architectural drawing and project planning reference image" fill sizes="(max-width: 760px) 100vw, 50vw" unoptimized /><span>Planning imagery · illustrative</span></div><div className="engineering-content">
          <span className="section-index">04 / A CONSIDERED PROCESS</span><h2>Better decisions<br /><em>before the build.</em></h2><p>Bring together design intent, drawings, site conditions and the practicalities of construction. The right project team and responsibilities are confirmed for each brief.</p>
          <div className="discipline-list">{disciplines.map((item, index) => <div className="discipline-row" key={item.title}><span>0{index + 1}</span><item.icon size={18} /><div><strong>{item.title}</strong><small>{item.detail}</small></div><Check size={15} /></div>)}</div>
        </div></section>

        <section className="section-block project-section" id="projects"><div className="site-container">
          <div className="section-heading-row"><div><span className="section-index">05 / SELECTED WORK</span><h2>Work, with its<br />own story to tell.</h2></div><div className="heading-side"><p>Published case studies are added only after the project details and imagery are reviewed.</p><Link className="underlined-link" href="/projects">View project archive <ArrowUpRight size={15} /></Link></div></div>
          {contentUnavailable ? <div className="content-empty" role="status"><span>PROJECT ARCHIVE</span><p>Published project content is temporarily unavailable. Please try again later.</p><Link href="/projects">Retry in the project archive ↗</Link></div> : projects.length > 0 ? <div className="project-grid">{projects.map((project, index) => <Link className={`project-card project-card-${index + 1}`} href={`/projects/${project.slug}`} key={project.id}>
            <div className="project-image">{project.coverImage ? <Image src={project.coverImage} alt={project.title} fill sizes="(max-width: 760px) 100vw, 60vw" unoptimized /> : <div className="project-image-empty"><ShieldCheck size={25} /><span>Project image pending</span></div>}<span className="project-open"><ArrowUpRight size={18} /></span></div>
            <div className="project-info"><span>{project.category} <i>·</i> {project.location}{project.year ? ` · ${project.year}` : ""}</span><h3>{project.title}</h3><p>{project.summary}</p></div>
          </Link>)}</div> : <div className="content-empty"><span>PROJECT ARCHIVE</span><p>Verified project case studies and company photography are being prepared for publication.</p><a href="#contact">Have a project to discuss? <ArrowUpRight size={14} /></a></div>}
        </div></section>

        {testimonials.length > 0 && <section className="testimonial-section"><div className="site-container testimonial-inner"><div><span className="section-index">06 / CLIENT WORDS</span><h2>Trust is earned,<br /><em>one project at a time.</em></h2></div><div className="testimonial-list">{testimonials.map((item) => <figure key={item.id}><blockquote>“{item.quote}”</blockquote><figcaption>{item.customerName}{item.attribution ? <span> · {item.attribution}</span> : null}</figcaption></figure>)}</div></div></section>}

        <section className="section-block journal-section" id="journal"><div className="site-container">
          <div className="section-heading-row"><div><span className="section-index">07 / THE JOURNAL</span><h2>Notes on building<br />with intention.</h2></div><Link className="underlined-link" href="/blog">Visit the journal <ArrowUpRight size={15} /></Link></div>
          {contentUnavailable ? <div className="journal-empty" role="status">Published articles are temporarily unavailable. Please try again later.</div> : posts.length > 0 ? <div className="journal-grid">{posts.map((post) => <article className="journal-card" key={post.id}>
            <Link className="journal-image" href={`/blog/${post.slug}`}>{post.coverImage ? <Image src={post.coverImage} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized /> : <div className="journal-image-empty"><span>N.S. / JOURNAL</span></div>}</Link>
            <div className="journal-meta"><span>{post.category}</span><time>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : ""}</time></div>
            <h3><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3><p>{post.excerpt}</p><Link className="card-link" href={`/blog/${post.slug}`}>Read article <ArrowUpRight size={14} /></Link>
          </article>)}</div> : <div className="journal-empty">Reviewed construction notes and practical guidance will appear here when published.</div>}
        </div></section>

        <section className="contact-section" id="contact"><div className="site-container">
          <div className="contact-heading"><div><span className="section-index">08 / START A CONVERSATION</span><h2>What are you<br /><em>looking to build?</em></h2></div><p>Share the outline. We’ll review your project details and get back to you about a suitable next step.</p></div>
          <EnquiryForm />
        </div></section>
      </main>
      <footer className="site-footer"><div className="site-container footer-main">
        <div className="footer-brand"><Link className="wordmark wordmark-light" href="/"><span className="wordmark-monogram">N<span>.</span>S</span><span className="wordmark-copy">N.S. CONSTRUCTION<small>BUILDING WITH PURPOSE</small></span></Link><p>Thoughtful project conversations.<br />Considered construction work.</p><span className="footer-location">LUCKNOW, UTTAR PRADESH, INDIA</span></div>
        <div className="footer-column"><span>EXPLORE</span><a href="#approach">Our approach</a><a href="#services">Capabilities</a><Link href="/projects">Projects</Link><Link href="/blog">Journal</Link></div>
        <div className="footer-column"><span>GET IN TOUCH</span><a href={`tel:${settings.phoneHref}`}>{settings.phoneDisplay}</a><a href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent("Hello N.S. Construction, I would like to discuss a project.")}`} target="_blank" rel="noreferrer">WhatsApp ↗</a><a href={settings.mapsUrl} target="_blank" rel="noreferrer">{settings.location} on Google Maps ↗</a><a href={settings.facebookUrl} target="_blank" rel="noreferrer">Facebook ↗</a>{settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram ↗</a>}</div>
      </div>      <div className="site-container footer-bottom"><span>© {new Date().getFullYear()} N.S. Construction</span><div><Link href="/privacy">Privacy</Link><Link href="/admin/login">Admin</Link></div><span>Built on trust. Delivered with care.</span></div></footer>
    </>
  );
}
