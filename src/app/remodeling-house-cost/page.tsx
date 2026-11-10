import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const title = "Remodeling House Cost: What Drives the Price | N.S. Construction";
const description = "How remodeling house cost is worked out: scope, structure, materials, services and contingency, plus how to budget a home renovation in Lucknow.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/remodeling-house-cost" },
  openGraph: { type: "article", title, description, url: `${siteUrl}/remodeling-house-cost` },
};

const faqs = [
  { q: "How is remodeling house cost calculated?", a: "A remodel is priced from a defined scope of work: the area being changed, the amount of demolition and structural work, the services (electrical, plumbing, waterproofing) that must be redone, and the grade of finishes. Each is measured and itemised rather than estimated as one lump figure." },
  { q: "Is remodeling cheaper than building a new house?", a: "Not automatically. A light cosmetic refresh costs far less than new construction, but a remodel that moves walls, replaces services and strengthens the structure can approach the cost of building new. The deciding factor is how much of the existing structure is sound and reusable." },
  { q: "How much contingency should I keep for a house remodel?", a: "Keep a reserve for concealed conditions such as damp walls, old wiring or weak plaster that only show once work opens up. A common planning practice is to hold roughly 10 to 15 percent of the remodel budget aside, adjusted for the age and condition of the house." },
  { q: "Can I remodel one room at a time?", a: "Yes. Phasing works well when the services are handled first. Doing electrical and plumbing for the whole house at once, even if finishes follow room by room, usually avoids repeat breaking and repair work." },
];

export default function RemodelingHouseCost() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Remodeling House Cost: What Drives the Price",
      description,
      mainEntityOfPage: `${siteUrl}/remodeling-house-cost`,
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
    <div className="section-index">Remodeling / Lucknow</div>
    <h1>Remodeling house cost: what drives the price</h1>
    <p className="article-lede">There is no single price per square foot for a remodel. The cost of remodeling a house depends on what is being changed, what is hidden behind the walls and how you want it finished. This guide explains how to work it out before you ask for quotes.</p>
    <div className="article-body">
      <h2>1. Scope of work is the biggest driver</h2>
      <p>Remodels range from repainting and replacing floor finishes to opening up rooms, adding a floor or rebuilding bathrooms and the kitchen. Write down every room and every change. The more precisely the scope is defined, the closer the quotation will be to the final bill.</p>
      <h2>2. Demolition and structural changes</h2>
      <p>Removing a non-load-bearing partition is a small job. Removing or relocating a load-bearing wall, cutting new openings or adding a storey needs structural design, temporary support and reinforcement. These items add cost and time, and should be checked by an engineer before work begins.</p>
      <h2>3. Electrical, plumbing and waterproofing</h2>
      <p>Older homes often have wiring, pipes and bathroom waterproofing that cannot simply be built over. Replacing concealed services is one of the most common reasons a remodel costs more than expected, and it is cheapest to do it once, before new finishes go on.</p>
      <h2>4. Materials and finishes</h2>
      <p>Tiles, marble or granite, paints, sanitaryware, kitchen fittings, doors and windows can be chosen across a wide range of grades and brands. Finishes are the part of a remodel that you control most directly, so decide the grade for each room early. Our <Link href="/materials">materials catalogue</Link> lists what we source.</p>
      <h2>5. Access, site conditions and living in the house</h2>
      <p>Working in an occupied house, in a narrow lane or on an upper floor affects labour time, material handling and debris removal. Tell your contractor if you will stay in the house during the work.</p>
      <h2>6. Approvals</h2>
      <p>Cosmetic work usually needs no permission, but adding floors or changing the built area can. Check requirements with the local authority before you commit to the design.</p>
      <h2>7. Contingency</h2>
      <p>Keep a reserve for conditions that only appear once work starts, such as damp, cracked plaster or corroded pipes. Older houses need a larger reserve than recently built ones.</p>
      <h2>How to budget a remodel step by step</h2>
      <p>1. List the rooms and the changes for each one. 2. Separate structural, services and finishing work. 3. Choose a finish grade per room. 4. Ask for an itemised quotation instead of a lump sum. 5. Add a contingency reserve. 6. Agree a payment schedule tied to completed stages.</p>
      <h2>Frequently asked questions</h2>
      {faqs.map(f => <div key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>)}
      <h2>Get an itemised estimate for your house</h2>
      <p>Every house is different, so we price remodels from your actual scope rather than quoting a generic rate. Use our <Link href="/quote">estimate builder</Link> to describe your project, or browse recent <Link href="/projects">projects</Link> and the <Link href="/blog">journal</Link> for more planning guides.</p>
    </div>
    <Link className="plain-link" href="/quote">Get an estimate →</Link>
  </article>;
}
