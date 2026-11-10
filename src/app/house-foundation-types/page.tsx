import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const title = "House Foundation Types: A Homeowner's Guide | N.S. Construction";
const description = "The main house foundation types, shallow and deep, how each works, when it suits a site, and how to choose a foundation for a home in Lucknow.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/house-foundation-types" },
  openGraph: { type: "article", title, description, url: `${siteUrl}/house-foundation-types` },
};

const faqs = [
  { q: "What are the main types of house foundation?", a: "Foundations are grouped as shallow or deep. Shallow types include isolated footings, strip (wall) footings, combined footings and raft (mat) foundations. Deep types include piles, piers and caissons. Which one is used depends on the soil, the loads from the building and the groundwater level." },
  { q: "Which foundation is most common for a small residential house?", a: "For low-rise houses on firm soil, isolated footings under columns linked by plinth beams are the most common choice in India, because they use less material than a continuous slab. Where soil is weaker or loads are spread widely, a raft foundation is often chosen instead." },
  { q: "How deep should a house foundation be?", a: "There is no single depth. The foundation must reach soil that can carry the load safely, sit below the zone of surface disturbance such as loose fill, topsoil and seasonal moisture change, and be set by the structural engineer from a soil investigation. Do not copy the depth used on a neighbouring plot." },
  { q: "Do I need a soil test before choosing a foundation?", a: "Yes. A soil investigation tells the engineer the bearing capacity of the ground and whether there is a high water table, fill or soft clay. The foundation design is based on it, and it costs far less than correcting a foundation that settles." },
  { q: "Can I add floors later on an existing foundation?", a: "Only if the foundation was designed for it. If you may add storeys in future, tell your engineer at the start so the footings and columns are sized for the extra load. Adding floors to an unprepared foundation needs a structural assessment and sometimes strengthening." },
];

export default function HouseFoundationTypes() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "House Foundation Types: A Homeowner's Guide",
      description,
      mainEntityOfPage: `${siteUrl}/house-foundation-types`,
      author: { "@type": "Organization", name: "N.S. Construction" },
      publisher: { "@type": "Organization", name: "N.S. Construction" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  return <article className="article-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <Link className="plain-link" href="/">← N.S. Construction</Link>
    <div className="section-index">Foundations / Lucknow</div>
    <h1>House foundation types: how to choose the right one</h1>
    <p className="article-lede">The foundation carries the whole weight of your house into the ground. Understanding the main house foundation types, and what decides between them, helps you ask better questions of your engineer and contractor before construction begins.</p>
    <div className="article-body">
      <h2>Shallow and deep foundations</h2>
      <p>Foundations fall into two broad groups. Shallow foundations spread the load to soil close to the surface and suit most low-rise homes on reasonably firm ground. Deep foundations pass through weak upper layers to reach stronger soil or rock below, and are used when the surface soil cannot safely carry the building.</p>

      <h2>1. Isolated (pad) footings</h2>
      <p>Each column rests on its own footing, and the footings are tied together with plinth or tie beams. This is the usual choice for framed (RCC column and beam) houses on good soil. It uses less concrete and steel than continuous systems, but depends on the soil being reasonably uniform under every column.</p>

      <h2>2. Strip (wall) footings</h2>
      <p>A continuous strip of concrete or masonry runs under load-bearing walls. It suits simple, low-rise structures where walls carry the loads and the soil is firm. It is less common in framed homes today.</p>

      <h2>3. Combined footings</h2>
      <p>Two or more columns share one footing. It is used where columns are close together, or where a column sits near the plot boundary and an isolated footing would extend beyond it.</p>

      <h2>4. Raft (mat) foundation</h2>
      <p>A single reinforced slab spreads the load of the whole building across its entire footprint. A raft is considered when soil bearing capacity is low, when isolated footings would cover most of the plot anyway, or when settlement between columns must be kept even. It uses more material, but it can be the simpler and safer answer on weaker ground.</p>

      <h2>5. Pile foundations</h2>
      <p>Long slender columns of concrete are bored or driven deep into the ground to reach firmer strata or to develop load by friction along their length. Piles are used on soft or filled ground, near water, or where the water table is high. They are specialist work and are designed from a detailed soil report.</p>

      <h2>6. Piers and caissons</h2>
      <p>These are larger-diameter deep shafts, used for heavier loads or where the firm layer is deeper than footings can economically reach. For ordinary houses they are rarely needed.</p>

      <h2>What decides the foundation type</h2>
      <ul>
        <li><strong>Soil bearing capacity.</strong> Established by a soil investigation, not by looking at the surface.</li>
        <li><strong>Building loads.</strong> Number of floors, spans and any planned future floors.</li>
        <li><strong>Groundwater.</strong> A high water table affects excavation, concrete protection and sometimes the choice of system.</li>
        <li><strong>Site conditions.</strong> Fill, nearby structures, slopes, trees and drainage.</li>
        <li><strong>Earthquake provisions.</strong> Lucknow lies in a seismic zone, so foundations should be tied together and detailed to the relevant Indian Standard codes.</li>
        <li><strong>Budget.</strong> The foundation is not the place to economise, but the right type is the one that does the job without waste.</li>
      </ul>

      <h2>Foundations in Lucknow</h2>
      <p>Much of Lucknow sits on Indo-Gangetic alluvial soil, with conditions that can vary from plot to plot, including layers of silt, sand and clay and a groundwater level that changes with season. Because of this variation, a soil test for your own plot is the sensible starting point. Foundation depth and type should always be set by a qualified structural engineer, not copied from nearby buildings.</p>

      <h2>Protecting the foundation</h2>
      <p>Good foundation work includes more than excavation and concrete: proper compaction and levelling, a lean concrete base, correctly placed and covered reinforcement, curing of concrete, and damp-proofing at plinth level. Poor drainage around the house can undermine even a well-built foundation, so plan site drainage at the same time.</p>

      <h2>How foundations fit into your budget</h2>
      <p>Foundation cost depends on soil, depth, type and quantity of concrete and steel, so it should appear as its own line in an itemised quotation. Our <Link href="/materials">materials catalogue</Link> lists the cement, steel and other materials we source for foundation work.</p>

      <h2>Frequently asked questions</h2>
      {faqs.map(f => <div key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>)}

      <h2>Planning a new house?</h2>
      <p>We start every build with the site and the soil. Use our <Link href="/quote">estimate builder</Link> to describe your project, browse completed <Link href="/projects">projects</Link>, or read more planning guides in the <Link href="/blog">journal</Link>. If you are renovating rather than building new, see <Link href="/remodeling-house-cost">remodeling house cost</Link>.</p>
    </div>
    <Link className="plain-link" href="/quote">Get an estimate →</Link>
  </article>;
}
