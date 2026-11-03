import { createHash } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintQuotationButton from "@/components/PrintQuotationButton";
import { prisma } from "@/lib/prisma";
import { getPublicSiteSettings } from "@/lib/site-settings";
import { logApiError } from "@/lib/api-errors";

export const metadata: Metadata = { title: "Your construction estimate", robots: { index: false, follow: false } };
const money = (value: { toString(): string } | number) => `₹${Number(value.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function CustomerQuotation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) notFound();
  const publicTokenHash = createHash("sha256").update(token).digest("hex");
  let quotation;
  try {
    quotation = await prisma.quotation.findUnique({
      where: { publicTokenHash },
      include: { customer: true, package: true, items: { orderBy: { createdAt: "asc" } } },
    });
  } catch (error) {
    logApiError("GET /quote/[token]", error);
    throw new Error("The estimate is temporarily unavailable.");
  }
  if (!quotation) notFound();

  try {
    if (quotation.status === "DRAFT" || quotation.status === "SENT") {
      const changed = await prisma.quotation.updateMany({ where: { id: quotation.id, status: { in: ["DRAFT", "SENT"] } }, data: { status: "VIEWED" } });
      if (changed.count > 0) {
        await prisma.quotationActivity.create({ data: { quotationId: quotation.id, action: "CUSTOMER_VIEWED", details: "The customer opened the secure quotation link.", actorEmail: "customer quotation portal" } });
        quotation.status = "VIEWED";
      }
    }
  } catch (error) {
    logApiError("GET /quote/[token] view tracking", error);
    throw new Error("The estimate is temporarily unavailable.");
  }
  const settings = await getPublicSiteSettings();
  const additionalCharges = Array.isArray(quotation.additionalCharges)
    ? quotation.additionalCharges.flatMap((entry) => typeof entry === "object" && entry !== null && "name" in entry && "total" in entry ? [{ name: String(entry.name), total: String(entry.total) }] : [])
    : [];
  const milestones = Array.isArray(quotation.paymentMilestones)
    ? quotation.paymentMilestones.flatMap((entry) => typeof entry === "object" && entry !== null && "label" in entry && "percentage" in entry ? [{ label: String(entry.label), percentage: String(entry.percentage) }] : [])
    : [];

  return <main className="quotation-document">
    <div className="print-toolbar"><Link href="/">N.S. CONSTRUCTION</Link><PrintQuotationButton /></div>
    <header className="quotation-document-header">
      <div className="quotation-brand"><span>N.S.</span><div><strong>N.S. CONSTRUCTION</strong><small>BUILDING WITH PURPOSE</small></div></div>
      <div className="quotation-company"><strong>{settings.location}</strong><span>{settings.phoneDisplay}</span></div>
    </header>
    <section className="quotation-title-block"><div><span className="section-index">PROJECT PROPOSAL / CONSTRUCTION ESTIMATE</span><h1>Construction<br /><em>quotation</em></h1></div><div className="quotation-number"><span>QUOTATION NUMBER</span><strong>{quotation.quotationNo}</strong><span>ISSUED {quotation.issuedAt.toLocaleDateString("en-IN")}</span><span>VALID UNTIL {quotation.validUntil.toLocaleDateString("en-IN")}</span><span>STATUS · {quotation.status.replaceAll("_", " ")}</span></div></section>
    <div className="quotation-document-rule" />
    <section className="quotation-parties">
      <div><span>PREPARED FOR</span><h2>{quotation.customer.name}</h2><p>{quotation.customer.phone}</p>{quotation.customer.email && <p>{quotation.customer.email}</p>}</div>
      <div><span>PROJECT INFORMATION</span><h2>{quotation.propertyType}</h2><p>{quotation.siteLocation}</p><p>{Number(quotation.constructionAreaSqFt.toString()).toLocaleString("en-IN")} sq. ft. construction area{quotation.plotAreaSqFt ? ` · ${Number(quotation.plotAreaSqFt.toString()).toLocaleString("en-IN")} sq. ft. plot` : ""}</p>{quotation.floors && <p>{quotation.floors} floors</p>}</div>
    </section>
    <section className="quotation-package-banner"><div><span>SELECTED PACKAGE</span><h2>{quotation.package.name}</h2><p>{quotation.package.description}</p></div><div><span>APPLICABLE RATE</span><strong>{money(quotation.applicableRatePerSqFt)}<small> / sq. ft.</small></strong></div></section>
    <section className="quotation-document-section"><div className="quotation-section-title"><span>01</span><h2>Material specifications</h2></div>
      {quotation.items.length ? <table className="quotation-spec-table"><thead><tr><th>Category</th><th>Specification</th><th>Quality</th><th>Package inclusion / rate impact</th></tr></thead><tbody>{quotation.items.map((item) => <tr key={item.id}><td>{item.categoryName}</td><td>{item.specificationName}{item.brand ? <small>{item.brand}</small> : null}{item.details && <small>{item.details}</small>}</td><td>{item.quality ? item.quality.charAt(0) + item.quality.slice(1).toLowerCase() : "Client-specific"}</td><td>{item.includedInPackage ? "Included in package" : `${money(item.adjustmentPerSqFt)} / sq. ft. additional`}</td></tr>)}</tbody></table> : <p>Material specifications to be confirmed after review of approved drawings and project scope.</p>}
    </section>
    <section className="quotation-document-section"><div className="quotation-section-title"><span>02</span><h2>Estimate summary</h2></div><div className="quotation-cost-table">
      <div><span>Package rate / sq. ft.</span><strong>{money(quotation.baseRatePerSqFt)}</strong></div>
      <div><span>Material specification adjustments / sq. ft.</span><strong>{quotation.upgradeRatePerSqFt.toString() === "0" ? "Included / none" : `+${money(quotation.upgradeRatePerSqFt)}`}</strong></div>
      <div><span>Chargeable area</span><strong>{Number(quotation.constructionAreaSqFt.toString()).toLocaleString("en-IN")} sq. ft.</strong></div>
      <div><span>Construction subtotal</span><strong>{money(quotation.subtotal)}</strong></div>
      {additionalCharges.map((charge, index) => <div key={`${charge.name}-${index}`}><span>{charge.name}</span><strong>{money(charge.total)}</strong></div>)}
      {quotation.gstRate !== null && <div><span>GST ({quotation.gstRate.toString()}%)</span><strong>{money(quotation.gstAmount)}</strong></div>}
      <div className="quotation-cost-total"><span>Indicative estimated total</span><strong>{money(quotation.totalAmount)}</strong></div>
    </div><p className="quotation-calculation">Applicable construction rate × chargeable construction area. Additional charges and configured taxes are listed separately.</p></section>
    {(quotation.inclusions || quotation.exclusions || quotation.requirements) && <section className="quotation-document-section quotation-scope-grid">
      {quotation.inclusions && <div><div className="quotation-section-title"><span>03</span><h2>Included scope</h2></div><p>{quotation.inclusions}</p></div>}
      {quotation.exclusions && <div><div className="quotation-section-title"><span>04</span><h2>Exclusions</h2></div><p>{quotation.exclusions}</p></div>}
      {quotation.requirements && <div className="quotation-requirement"><div className="quotation-section-title"><span>05</span><h2>Project requirements</h2></div><p>{quotation.requirements}</p></div>}
    </section>}
    {milestones.length > 0 && <section className="quotation-document-section"><div className="quotation-section-title"><span>06</span><h2>Payment milestones</h2></div><div className="quotation-milestones">{milestones.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.percentage}%</strong></div>)}</div></section>}
    <section className="quotation-terms"><span>ESTIMATE BASIS & COMMERCIAL TERMS</span><p>This quotation is an indicative estimate and is subject to site inspection, structural requirements, approved drawings, final material specifications and a detailed scope of work. The rate depends on confirmed specifications, brands, materials and finishes. Labour, material supply, transportation, machinery, approvals and other items are included only where expressly listed in the package inclusions; exclusions and additional charges are shown separately. No final fixed price is confirmed until the scope and specifications are approved by both parties.</p><p>Validity: {quotation.validityDays} days from the issue date. Taxes, where configured, are shown separately above.</p></section>
    <section className="quotation-acceptance"><div><span>FOR N.S. CONSTRUCTION</span><div className="quotation-signature-line" /><small>Authorised representative</small></div><div><span>CLIENT ACCEPTANCE</span><div className="quotation-signature-line" /><small>Name, signature and date</small></div></section>
    <footer className="quotation-document-footer"><strong>N.S. CONSTRUCTION</strong><span>{settings.phoneDisplay} · {settings.location}</span><small>Prepared for the named customer. Please confirm site details and approved specifications with our team.</small></footer>
  </main>;
}
