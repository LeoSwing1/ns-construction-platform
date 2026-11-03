"use client";

import { ArrowLeft, ArrowRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Grade = "ESSENTIAL" | "PREMIUM" | "LUXURY";
type PackageOption = { id: string; code: string; name: string; description: string; quality: Grade; ratePerSqFt: string | null; validityDays: number; inclusions: string; exclusions: string };
type Specification = { id: string; name: string; quality: Grade; brand: string | null; details: string };
type Category = { id: string; name: string; specifications: Specification[] };
type Estimate = {
  packageId: string; packageName: string; quality: Grade; baseRatePerSqFt: number; upgradeRatePerSqFt: number; applicableRatePerSqFt: number;
  areaSqFt: number; subtotal: number; additionalCharges: { name: string; type: string; amount: number; total: number }[]; additionalChargesTotal: number;
  gstRate: number | null; gstAmount: number; totalAmount: number; validityDays: number; inclusions: string; exclusions: string;
  paymentMilestones: { label: string; percentage: number }[]; items: { specificationId: string; categoryId: string; categoryName: string; specificationName: string; quality: Grade; brand: string | null; details: string; packageAllowance: { specificationName: string; quality: Grade; brand: string | null } | null; adjustmentPerSqFt: number; includedInPackage: boolean; abovePackageGrade: boolean }[];
  recommendedPackage: { id: string; name: string; quality: Grade; ratePerSqFt: number | null; totalAmount: number | null; applicableRatePerSqFt: number | null; unavailableReason: string | null } | null;
  rateDifference: number;
};
type Config = { packages: PackageOption[]; categories: Category[] };
type FormState = { name: string; phone: string; email: string; location: string; propertyType: string; plotArea: string; area: string; floors: string; requirements: string };
const emptyForm: FormState = { name: "", phone: "", email: "", location: "", propertyType: "", plotArea: "", area: "", floors: "", requirements: "" };
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const gradeLabel = (quality: Grade) => quality.charAt(0) + quality.slice(1).toLowerCase();

async function readApiResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(response.ok ? "The server returned an unexpected response." : "The service is temporarily unavailable. Please try again.");
  }
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    throw new Error("The server returned an invalid response. Please try again.");
  }
  throw new Error("The server returned an invalid response. Please try again.");
}

export default function QuoteBuilder() {
  const [config, setConfig] = useState<Config | null>(null);
  const [packageId, setPackageId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submissionId] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<{ quotationNo: string; message: string; quotationUrl: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/quotations/config")
      .then(async (response) => {
        const body = await readApiResponse(response);
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Quotation options could not be loaded.");
        if (!active) return;
        const data = body as Config;
        setConfig(data);
        setPackageId(data.packages.find((item) => item.code === "ESSENTIAL")?.id || "");
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Quotation options could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedItems = useMemo(() => Object.entries(selections).filter(([, id]) => id).map(([categoryId, specificationId]) => ({ categoryId, specificationId })), [selections]);

  useEffect(() => {
    if (!packageId || !form.area || Number(form.area) <= 0) { setEstimate(null); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCalculating(true);
      setError("");
      try {
        const response = await fetch("/api/quotations/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId, constructionAreaSqFt: Number(form.area), selections: selectedItems }),
          signal: controller.signal,
        });
        const body = await readApiResponse(response);
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The estimate could not be calculated.");
        setEstimate(body as Estimate);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setEstimate(null);
          setError(cause instanceof Error ? cause.message : "The estimate could not be calculated.");
        }
      } finally {
        if (!controller.signal.aborted) setCalculating(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [packageId, form.area, selectedItems]);

  function update(key: keyof FormState, value: string) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!estimate) { setError("Enter a valid construction area and resolve any material pricing notices before requesting the estimate."); return; }
    if (estimate.items.some((item) => !item.includedInPackage) && !confirmed) {
      setError("Please review and confirm the itemised material upgrades to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          packageId,
          constructionAreaSqFt: Number(form.area),
          selections: selectedItems,
          name: form.name,
          phone: form.phone,
          email: form.email,
          siteLocation: form.location,
          propertyType: form.propertyType,
          plotAreaSqFt: form.plotArea ? Number(form.plotArea) : null,
          floors: form.floors ? Number(form.floors) : null,
          requirements: form.requirements,
          confirmUpgrades: confirmed,
        }),
      });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Your quotation request could not be recorded.");
      setResult({
        quotationNo: typeof body.quotationNo === "string" ? body.quotationNo : "Recorded",
        message: typeof body.message === "string" ? body.message : "Your estimate has been recorded.",
        quotationUrl: typeof body.quotationUrl === "string" ? body.quotationUrl : null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your quotation request could not be recorded.");
    } finally { setSubmitting(false); }
  }

  if (result) return <main className="quote-page"><section className="quote-success"><span><Check size={25} /></span><div className="section-index">ESTIMATE RECORDED / {result.quotationNo}</div><h1>Your next step,<br /><em>clearly set out.</em></h1><p>{result.message}</p><p>Keep this reference for your records: <strong>{result.quotationNo}</strong></p>{result.quotationUrl && <Link className="btn" href={result.quotationUrl}>View or save your estimate as PDF ↗</Link>}<Link className="plain-link" href="/">Return to N.S. Construction</Link></section></main>;

  return <main className="quote-page">
    <header className="quote-topbar"><Link href="/" className="plain-link"><ArrowLeft size={15} /> N.S. CONSTRUCTION</Link><span>CONSTRUCTION ESTIMATE / INDICATIVE ONLY</span></header>
    <section className="quote-hero">
      <div className="section-index">N.S. CONSTRUCTION / PROJECT ESTIMATOR</div>
      <h1>A clearer view<br />of <em>what you’re building.</em></h1>
      <p>Choose your construction package, area and material specifications. Every price change is shown before you request an estimate.</p>
      <div className="quote-assurance"><ShieldCheck size={18} /><span>Server-calculated · Itemised material choices · No hidden specification upgrades</span></div>
    </section>

    {loading ? <div className="quote-loading"><LoaderCircle className="spin" /> Loading package and material options…</div> : !config ? <div className="quote-error" role="alert"><p>{error || "Quotation options are unavailable."}</p><button className="btn" type="button" onClick={() => window.location.reload()}>Try again ↗</button></div> : (
      <div className="quote-layout">
        <form className="quote-form" onSubmit={submit}>
          <section className="quote-step">
            <div className="quote-step-heading"><span>01</span><div><h2>Your project</h2><p>Tell us the site, property type and approximate build area.</p></div></div>
            <div className="quote-field-grid">
              <label>Full name *<input autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" /></label>
              <label>Phone number *<input autoComplete="tel" type="tel" required minLength={8} maxLength={24} pattern="[0-9+\(\) .\-]{8,24}" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91" /></label>
              <label>Email address<input autoComplete="email" type="email" maxLength={254} value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" /></label>
              <label>Property type *<select required value={form.propertyType} onChange={(event) => update("propertyType", event.target.value)}><option value="">Select property type</option>{["Independent home", "Residential building", "Commercial development", "Civil / structural project", "Interior / renovation", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="quote-field-wide">Site location *<input required maxLength={240} value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="Area, city or site address" /></label>
              <label>Plot area (sq. ft.)<input type="number" min="1" step="0.01" value={form.plotArea} onChange={(event) => update("plotArea", event.target.value)} placeholder="If known" /></label>
              <label>Construction area (sq. ft.) *<input required type="number" min="1" max="1000000" step="0.01" value={form.area} onChange={(event) => update("area", event.target.value)} placeholder="Chargeable built-up area" /></label>
              <label>Number of floors<input type="number" min="1" max="100" step="1" value={form.floors} onChange={(event) => update("floors", event.target.value)} placeholder="If known" /></label>
              <label className="quote-field-wide">Construction requirements<textarea rows={3} maxLength={5000} value={form.requirements} onChange={(event) => update("requirements", event.target.value)} placeholder="Scope, plans or client-specific requirements" /></label>
            </div>
          </section>

          <section className="quote-step">
            <div className="quote-step-heading"><span>02</span><div><h2>Select a package</h2><p>Published rates are indicative starting rates, subject to approved scope and site conditions.</p></div></div>
            <div className="quote-package-grid">
              {config.packages.map((item) => (
                <button className={`quote-package ${packageId === item.id ? "is-selected" : ""}`} type="button" key={item.id} onClick={() => { setPackageId(item.id); setConfirmed(false); }}>
                  <span>{gradeLabel(item.quality)} / CONSTRUCTION</span><strong>{item.name}</strong><p>{item.description}</p>
                  <b>{item.ratePerSqFt ? `${money(Number(item.ratePerSqFt))} / sq. ft.` : "Rate being configured"}</b>
                  {packageId === item.id && <i><Check size={14} /> Selected</i>}
                </button>
              ))}
            </div>
          </section>

          <section className="quote-step">
            <div className="quote-step-heading"><span>03</span><div><h2>Material specifications</h2><p>Optional choices are compared with the selected package and priced only from administrator-configured rules. No brand or price is assumed.</p></div></div>
            {config.categories.filter((category) => category.specifications.length > 0).length === 0 ? (
              <p className="quote-catalog-empty">Material options are being prepared. Your team can configure approved products and pricing in the quotation control room.</p>
            ) : (
              <div className="quote-material-grid">{config.categories.filter((category) => category.specifications.length > 0).map((category) => (
                <label key={category.id}>{category.name}
                  <select value={selections[category.id] || ""} onChange={(event) => { setSelections((current) => ({ ...current, [category.id]: event.target.value })); setConfirmed(false); }}>
                    <option value="">Use package specification / to be discussed</option>
                    {category.specifications.map((spec) => <option value={spec.id} key={spec.id}>{spec.name} · {gradeLabel(spec.quality)}{spec.brand ? ` · ${spec.brand}` : ""}</option>)}
                  </select>
                </label>
              ))}</div>
            )}
          </section>

          {error && <p className="quote-error" role="alert">{error}</p>}
          <p className="quote-terms">Rates depend on approved specifications, brands, materials, finishes, structural drawings and site conditions. This estimate is indicative and subject to site inspection, structural requirements, approved drawings, final specifications and a detailed scope of work. Any taxes, additional charges, inclusions and exclusions are shown separately when configured.</p>
          <button className="quote-submit" type="submit" disabled={submitting || calculating || !estimate}>
            {submitting ? "Recording estimate…" : calculating ? "Calculating…" : "Request this indicative estimate"} <ArrowRight size={17} />
          </button>
        </form>

        <aside className="quote-summary" aria-live="polite">
          <div className="section-index">LIVE ESTIMATE / REVIEW</div>
          <h2>{estimate?.packageName || "Your estimate"}</h2>
          {!form.area ? <p className="quote-muted">Enter the approximate construction area to calculate an estimate.</p> : calculating ? <p className="quote-muted"><LoaderCircle className="spin" /> Updating your specification…</p> : !estimate ? <p className="quote-muted">The estimate will appear after the required pricing rules are configured.</p> : <>
            <div className="quote-rate"><span>Base package rate</span><strong>{money(estimate.baseRatePerSqFt)}<small> / sq. ft.</small></strong></div>
            <div className="quote-rate"><span>Material upgrades</span><strong>{estimate.upgradeRatePerSqFt > 0 ? "+" : ""}{money(estimate.upgradeRatePerSqFt)}<small> / sq. ft.</small></strong></div>
            <div className="quote-rate quote-rate-total"><span>Applicable construction rate</span><strong>{money(estimate.applicableRatePerSqFt)}<small> / sq. ft.</small></strong></div>
            <div className="quote-calc-line"><span>{estimate.areaSqFt.toLocaleString("en-IN")} sq. ft. × {money(estimate.applicableRatePerSqFt)}</span><strong>{money(estimate.subtotal)}</strong></div>
            {estimate.items.map((item) => <div className={`quote-upgrade ${item.abovePackageGrade ? "is-upgrade" : ""}`} key={item.specificationId}>
              <span>{item.includedInPackage ? "Included" : item.abovePackageGrade ? "Grade upgrade" : "Additional selection"} · {item.categoryName}
                <small>Selected: {item.specificationName}{item.brand ? ` · ${item.brand}` : ""} · {gradeLabel(item.quality)}</small>
                <small>Package allowance: {item.packageAllowance ? `${item.packageAllowance.specificationName}${item.packageAllowance.brand ? ` · ${item.packageAllowance.brand}` : ""} · ${gradeLabel(item.packageAllowance.quality)}` : "No configured allowance"}</small>
              </span>
              <strong>{item.includedInPackage ? "Included" : `+${money(item.adjustmentPerSqFt * estimate.areaSqFt)} total · ${money(item.adjustmentPerSqFt)}/sq. ft.`}</strong>
            </div>)}
            {estimate.items.some((item) => !item.includedInPackage) && <label className="quote-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I have reviewed and confirm the itemised specification upgrades and their displayed price impact.</label>}
            {estimate.recommendedPackage && estimate.recommendedPackage.id !== estimate.packageId && <div className="quote-recommendation">
              <span>SPECIFICATION-BASED RECOMMENDATION</span><strong>{estimate.recommendedPackage.name}</strong>
              {estimate.recommendedPackage.totalAmount === null ? <p>{estimate.recommendedPackage.unavailableReason}</p> : <><p>Selected specifications exceed this package’s grade. The package rate and material adjustments are calculated separately.</p><div className="quote-calc-line"><span>Recommended estimate</span><strong>{money(estimate.recommendedPackage.totalAmount)}</strong></div><div className="quote-calc-line"><span>Difference from current selection</span><strong>{estimate.rateDifference >= 0 ? "+" : "−"}{money(Math.abs(estimate.rateDifference))}</strong></div><button className="quote-recommend-button" type="button" onClick={() => { setPackageId(estimate.recommendedPackage!.id); setConfirmed(false); }}>Review this package ↗</button></>}
            </div>}
            {estimate.additionalCharges.map((charge) => <div className="quote-calc-line" key={charge.name}><span>{charge.name}{charge.type === "PERCENT" ? ` (${charge.amount}%)` : ""}</span><strong>{money(charge.total)}</strong></div>)}
            {estimate.gstRate !== null && <div className="quote-calc-line"><span>GST ({estimate.gstRate}%)</span><strong>{money(estimate.gstAmount)}</strong></div>}
            <div className="quote-grand-total"><span>Indicative total estimate</span><strong>{money(estimate.totalAmount)}</strong><small>Based on {estimate.areaSqFt.toLocaleString("en-IN")} sq. ft. · Final estimation subject to site inspection</small></div>
            {estimate.inclusions && <div className="quote-scope"><span>PACKAGE INCLUSIONS</span><p>{estimate.inclusions}</p></div>}
            {estimate.exclusions && <div className="quote-scope"><span>PACKAGE EXCLUSIONS</span><p>{estimate.exclusions}</p></div>}
            {estimate.paymentMilestones.length > 0 && <div className="quote-scope"><span>PAYMENT MILESTONES</span>{estimate.paymentMilestones.map((milestone) => <p key={milestone.label}>{milestone.label} · {milestone.percentage}%</p>)}</div>}
            <div className="quote-validity">Indicative estimate validity: {estimate.validityDays} days from issue. No fixed price is confirmed by this online estimate.</div>
          </>}
        </aside>
      </div>
    )}
    <footer className="quote-footer">N.S. CONSTRUCTION · Building with purpose <a href="/privacy">Privacy</a></footer>
  </main>;
}
