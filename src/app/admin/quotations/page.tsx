"use client";

import { useCallback, useEffect, useState } from "react";

type Grade = "ESSENTIAL" | "PREMIUM" | "LUXURY";
type QuoteStatus = "DRAFT" | "SENT" | "VIEWED" | "UNDER_DISCUSSION" | "REVISION_REQUESTED" | "ACCEPTED" | "REJECTED" | "EXPIRED";
type Charge = { name: string; type: "FIXED" | "PERCENT"; amount: number };
type Milestone = { label: string; percentage: number };
type Package = { id: string; code: string; name: string; quality: Grade; ratePerSqFt: string | null; gstRate: string | null; validityDays: number; inclusions: string; exclusions: string; additionalCharges: Charge[]; paymentMilestones: Milestone[]; packageMaterials: { categoryId: string; specificationId: string }[] };
type Rule = { packageId: string; adjustmentPerSqFt: string };
type Material = { id: string; name: string; quality: Grade; brand: string | null; details: string; active: boolean; pricingRules: Rule[]; defaultFor: { packageId: string }[] };
type Category = { id: string; name: string; specifications: Material[] };
type Quote = {
  id: string; quotationNo: string; status: QuoteStatus; propertyType: string; siteLocation: string; constructionAreaSqFt: string; plotAreaSqFt: string | null; floors: number | null; requirements: string;
  totalAmount: string; applicableRatePerSqFt: string; createdAt: string; customer: { name: string; phone: string; email: string | null };
  package: { name: string; quality: Grade }; enquiry: { followUpAt: string | null } | null; items: { specificationId: string | null; categoryName: string; specificationName: string; quality: Grade | null; brand: string | null; adjustmentPerSqFt: string; includedInPackage: boolean }[];
  _count: { revisions: number };
};
type RevisionRecord = { revision: number; snapshot: unknown; actorEmail: string; createdAt: string };
type CatalogResponse = { categories: Category[]; packages: Package[] };
type DashboardResponse = { quotations: Quote[]; canManagePricing: boolean; analytics: { total: number; drafts: number; sent: number; accepted: number; rejected: number; totalEstimatedValue: number; conversionRate: number; followUpsDue: number } };
type NewQuote = { name: string; phone: string; email: string; siteLocation: string; propertyType: string; plotArea: string; area: string; floors: string; requirements: string; packageId: string; selections: Record<string, string> };
const emptyNewQuote: NewQuote = { name: "", phone: "", email: "", siteLocation: "", propertyType: "", plotArea: "", area: "", floors: "", requirements: "", packageId: "", selections: {} };
const statuses: QuoteStatus[] = ["DRAFT", "SENT", "VIEWED", "UNDER_DISCUSSION", "REVISION_REQUESTED", "ACCEPTED", "REJECTED", "EXPIRED"];
const gradeTitle = (grade: Grade) => grade.charAt(0) + grade.slice(1).toLowerCase();
const money = (value: string | number | null) => value === null ? "Not configured" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const lineText = <T extends { name?: string; label?: string; type?: string; amount?: number; percentage?: number }>(items: T[], kind: "charges" | "milestones") => items.map((item) => kind === "charges" ? `${item.name}|${item.type}|${item.amount}` : `${item.label}|${item.percentage}`).join("\n");

export default function QuotationsAdmin() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [analytics, setAnalytics] = useState<DashboardResponse["analytics"] | null>(null);
  const [canManagePricing, setCanManagePricing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<"pipeline" | "packages" | "materials">("pipeline");
  const [notice, setNotice] = useState("");
  const [viewLink, setViewLink] = useState("");
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newQuote, setNewQuote] = useState(emptyNewQuote);
  const [newQuoteEstimate, setNewQuoteEstimate] = useState<{ totalAmount: number; applicableRatePerSqFt: number; items: { categoryName: string; specificationName: string; includedInPackage: boolean; adjustmentPerSqFt: number; abovePackageGrade: boolean }[] } | null>(null);
  const [confirmNewQuoteUpgrades, setConfirmNewQuoteUpgrades] = useState(false);
  const [chargesText, setChargesText] = useState<Record<string, string>>({});
  const [milestonesText, setMilestonesText] = useState<Record<string, string>>({});
  const [materialForm, setMaterialForm] = useState({ categoryId: "", id: "", name: "", quality: "ESSENTIAL" as Grade, brand: "", details: "" });
  const [ruleValues, setRuleValues] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState<Quote | null>(null);
  const [revisionForm, setRevisionForm] = useState({ packageId: "", area: "", propertyType: "", siteLocation: "", plotArea: "", floors: "", requirements: "", selections: {} as Record<string, string> });
  const [revisionPreview, setRevisionPreview] = useState<{ totalAmount: number; applicableRatePerSqFt: number; items: { categoryName: string; specificationName: string; includedInPackage: boolean; adjustmentPerSqFt: number; abovePackageGrade: boolean }[] } | null>(null);
  const [confirmRevisionUpgrades, setConfirmRevisionUpgrades] = useState(false);
  const [historyQuote, setHistoryQuote] = useState<Quote | null>(null);
  const [revisionRecords, setRevisionRecords] = useState<RevisionRecord[]>([]);

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("q", search.trim());
    if (statusFilter) query.set("status", statusFilter);
    const [quoteResponse, packageResponse, catalogResponse] = await Promise.all([
      fetch(`/api/admin/quotations?${query}`),
      fetch("/api/admin/quotations/packages"),
      fetch("/api/admin/quotations/materials"),
    ]);
    if ([quoteResponse.status, packageResponse.status, catalogResponse.status].includes(401)) { location.href = "/admin/login"; return; }
    const [quoteBody, packageBody, catalogBody] = await Promise.all([quoteResponse.json(), packageResponse.json(), catalogResponse.json()]);
    for (const [response, body] of [[quoteResponse, quoteBody], [packageResponse, packageBody], [catalogResponse, catalogBody]] as const) {
      if (!response.ok) throw new Error(body.error || "Quotation management data could not be loaded.");
    }
    const dashboard = quoteBody as DashboardResponse;
    setQuotes(dashboard.quotations);
    setAnalytics(dashboard.analytics);
    setCanManagePricing(dashboard.canManagePricing);
    setPackages(packageBody as Package[]);
    setCategories((catalogBody as CatalogResponse).categories);
    setChargesText(Object.fromEntries((packageBody as Package[]).map((item) => [item.id, lineText(item.additionalCharges || [], "charges")])));
    setMilestonesText(Object.fromEntries((packageBody as Package[]).map((item) => [item.id, lineText(item.paymentMilestones || [], "milestones")])));
  }, [search, statusFilter]);

  useEffect(() => { load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Quotation management data could not be loaded.")); }, [load]);

  function updatePackage(id: string, key: keyof Package, value: string | number | null) {
    setPackages((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }

  function parseLines(id: string, kind: "charges" | "milestones") {
    const lines = (kind === "charges" ? chargesText[id] : milestonesText[id]).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (kind === "charges") return lines.map((line) => {
      const [name, type, raw] = line.split("|").map((part) => part.trim());
      if (!name || !["FIXED", "PERCENT"].includes(type) || !Number.isFinite(Number(raw)) || Number(raw) < 0) throw new Error("Use one additional charge per line: Name|FIXED or PERCENT|amount.");
      return { name, type, amount: Number(raw) };
    });
    const result = lines.map((line) => {
      const [label, raw] = line.split("|").map((part) => part.trim());
      if (!label || !Number.isFinite(Number(raw)) || Number(raw) <= 0 || Number(raw) > 100) throw new Error("Use one payment milestone per line: Label|percentage.");
      return { label, percentage: Number(raw) };
    });
    if (result.reduce((sum, item) => sum + item.percentage, 0) > 100.001) throw new Error("Payment milestone percentages must not exceed 100%.");
    return result;
  }

  async function savePackage(item: Package) {
    setBusy(item.id); setNotice("");
    try {
      const body = {
        id: item.id,
        ratePerSqFt: item.ratePerSqFt === null || item.ratePerSqFt === "" ? null : Number(item.ratePerSqFt),
        gstRate: item.gstRate === null || item.gstRate === "" ? null : Number(item.gstRate),
        validityDays: item.validityDays,
        inclusions: item.inclusions,
        exclusions: item.exclusions,
        additionalCharges: parseLines(item.id, "charges"),
        paymentMilestones: parseLines(item.id, "milestones"),
      };
      const response = await fetch("/api/admin/quotations/packages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Package could not be saved.");
      setNotice(`${item.name} pricing and terms saved.`);
      await load();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Package could not be saved."); }
    finally { setBusy(""); }
  }

  async function saveMaterial(event: React.FormEvent) {
    event.preventDefault(); setBusy("material"); setNotice("");
    const response = await fetch("/api/admin/quotations/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: materialForm.id ? "update" : "create", ...(materialForm.id ? { specificationId: materialForm.id } : {}), categoryId: materialForm.categoryId, name: materialForm.name, quality: materialForm.quality, brand: materialForm.brand || null, details: materialForm.details }) });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Material specification could not be saved."); setBusy(""); return; }
    setMaterialForm({ categoryId: "", id: "", name: "", quality: "ESSENTIAL", brand: "", details: "" });
    setNotice("Material specification saved. Add package-specific pricing or mark it as included below.");
    await load(); setBusy("");
  }

  async function saveRule(packageId: string, specification: Material) {
    const value = ruleValues[`${packageId}:${specification.id}`] ?? specification.pricingRules.find((rule) => rule.packageId === packageId)?.adjustmentPerSqFt ?? "";
    if (value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) { setNotice("Enter a non-negative per-square-foot adjustment before saving."); return; }
    const response = await fetch("/api/admin/quotations/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pricing", packageId, specificationId: specification.id, adjustmentPerSqFt: Number(value) }) });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Pricing rule could not be saved."); return; }
    setNotice(`Pricing rule saved for ${specification.name} / ${packages.find((item) => item.id === packageId)?.name}.`);
    await load();
  }

  async function setDefault(packageId: string, categoryId: string, specificationId: string) {
    const response = await fetch("/api/admin/quotations/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "default", packageId, categoryId, specificationId: specificationId || null }) });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Package inclusion could not be saved."); return; }
    setNotice("Included package specification updated. It will not be charged again as an upgrade.");
    await load();
  }

  async function updateStatus(item: Quote, status: QuoteStatus) {
    setBusy(item.id);
    const response = await fetch("/api/admin/quotations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status }) });
    const result = await response.json();
    if (!response.ok) setNotice(result.error || "Quotation status could not be updated.");
    else { setNotice(`${item.quotationNo} status updated to ${status.replaceAll("_", " ")}.`); await load(); }
    setBusy("");
  }

  async function duplicate(item: Quote) {
    setBusy(item.id);
    const response = await fetch(`/api/admin/quotations/${item.id}/duplicate`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) setNotice(body.error || "Quotation could not be duplicated.");
    else { setNotice(`Draft copy ${body.quotationNo} created.`); await load(); }
    setBusy("");
  }

  async function remove(item: Quote) {
    if (!window.confirm(`Delete draft ${item.quotationNo}? Only draft quotations can be removed.`)) return;
    const response = await fetch(`/api/admin/quotations/${item.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) setNotice(body.error || "Quotation could not be deleted.");
    else { setNotice("Draft quotation deleted."); await load(); }
  }

  async function showHistory(item: Quote) {
    const response = await fetch(`/api/admin/quotations/${item.id}`);
    const body = await response.json();
    if (!response.ok) { setNotice(body.error || "Revision history could not be loaded."); return; }
    setHistoryQuote(item);
    setRevisionRecords(body.revisions);
  }

  async function saveRevision(event: React.FormEvent) {
    event.preventDefault();
    if (!revision) return;
    if (!revisionPreview) { setNotice("Preview the recalculated revision before saving it."); return; }
    if (revisionPreview.items.some((item) => !item.includedInPackage) && !confirmRevisionUpgrades) { setNotice("Confirm the itemised material selections before saving this revision."); return; }
    const response = await fetch(`/api/admin/quotations/${revision.id}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId: revisionForm.packageId,
        constructionAreaSqFt: Number(revisionForm.area),
        selections: Object.entries(revisionForm.selections).filter(([, id]) => id).map(([categoryId, specificationId]) => ({ categoryId, specificationId })),
        propertyType: revisionForm.propertyType,
        siteLocation: revisionForm.siteLocation,
        plotAreaSqFt: revisionForm.plotArea ? Number(revisionForm.plotArea) : null,
        floors: revisionForm.floors ? Number(revisionForm.floors) : null,
        requirements: revisionForm.requirements,
      }),
    });
    const body = await response.json();
    if (!response.ok) { setNotice(body.error || "Quotation revision could not be saved."); return; }
    setRevision(null); setRevisionPreview(null); setNotice("Revision saved. The previously issued quotation is retained in revision history."); await load();
  }

  async function previewRevision() {
    setBusy("revision-preview"); setNotice("");
    const response = await fetch("/api/quotations/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId: revisionForm.packageId,
        constructionAreaSqFt: Number(revisionForm.area),
        selections: Object.entries(revisionForm.selections).filter(([, id]) => id).map(([categoryId, specificationId]) => ({ categoryId, specificationId })),
      }),
    });
    const body = await response.json();
    if (!response.ok) { setNotice(body.error || "Revision estimate could not be calculated."); setRevisionPreview(null); setBusy(""); return; }
    setRevisionPreview(body);
    setConfirmRevisionUpgrades(false);
    setNotice("Revision preview recalculated from the current approved pricing rules.");
    setBusy("");
  }

  async function previewNewQuote() {
    setBusy("new-quote-preview"); setNotice("");
    const response = await fetch("/api/quotations/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId: newQuote.packageId,
        constructionAreaSqFt: Number(newQuote.area),
        selections: Object.entries(newQuote.selections).filter(([, id]) => id).map(([categoryId, specificationId]) => ({ categoryId, specificationId })),
      }),
    });
    const body = await response.json();
    if (!response.ok) { setNotice(body.error || "Estimate preview could not be calculated."); setNewQuoteEstimate(null); setBusy(""); return; }
    setNewQuoteEstimate(body);
    setConfirmNewQuoteUpgrades(false);
    setNotice("Server-calculated estimate preview ready. Review material upgrades before creating the quotation.");
    setBusy("");
  }

  async function createQuotation(event: React.FormEvent) {
    event.preventDefault();
    if (!newQuoteEstimate) { setNotice("Preview the server-calculated total before creating this quotation."); return; }
    if (newQuoteEstimate.items.some((item) => !item.includedInPackage) && !confirmNewQuoteUpgrades) { setNotice("Confirm the itemised material upgrades before creating the quotation."); return; }
    setBusy("new-quote-create");
    const response = await fetch("/api/admin/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newQuote.name,
        phone: newQuote.phone,
        email: newQuote.email,
        siteLocation: newQuote.siteLocation,
        propertyType: newQuote.propertyType,
        plotAreaSqFt: newQuote.plotArea ? Number(newQuote.plotArea) : null,
        constructionAreaSqFt: Number(newQuote.area),
        floors: newQuote.floors ? Number(newQuote.floors) : null,
        requirements: newQuote.requirements,
        packageId: newQuote.packageId,
        selections: Object.entries(newQuote.selections).filter(([, id]) => id).map(([categoryId, specificationId]) => ({ categoryId, specificationId })),
        confirmUpgrades: confirmNewQuoteUpgrades,
      }),
    });
    const body = await response.json();
    if (!response.ok) { setNotice(body.error || "Quotation could not be created."); setBusy(""); return; }
    setViewLink(body.quotationUrl);
    setNotice(`Quotation ${body.quotationNo} created for ${money(body.totalAmount)} and linked to the customer CRM.`);
    setCreateOpen(false); setNewQuote(emptyNewQuote); setNewQuoteEstimate(null); setBusy("");
    await load();
  }

  function beginRevision(item: Quote) {
    const selected = Object.fromEntries(item.items.filter((line) => line.specificationId).map((line) => {
      const match = categories.find((category) => category.name === line.categoryName);
      return [match?.id || "", line.specificationId || ""];
    }).filter(([categoryId]) => categoryId));
    setRevision(item);
    setRevisionPreview(null);
    setConfirmRevisionUpgrades(false);
    setRevisionForm({
      packageId: packages.find((entry) => entry.name === item.package.name)?.id || "",
      area: item.constructionAreaSqFt,
      propertyType: item.propertyType,
      siteLocation: item.siteLocation,
      plotArea: item.plotAreaSqFt || "",
      floors: item.floors?.toString() || "",
      requirements: item.requirements,
      selections: selected,
    });
  }

  const totalTiles = analytics ? [
    ["Total quotations", analytics.total],
    ["Draft", analytics.drafts],
    ["Sent", analytics.sent],
    ["Accepted", analytics.accepted],
    ["Rejected", analytics.rejected],
    ["Follow-ups due", analytics.followUpsDue],
    ["Estimated value", money(analytics.totalEstimatedValue)],
    ["Conversion", `${analytics.conversionRate}%`],
  ] as const : [];

  return <main className="admin-page quotation-admin">
    <a className="plain-link" href="/admin">← Control room</a>
    <div className="section-index">ESTIMATION / COMMERCIAL CONTROL</div><h1>Quotations & material pricing</h1>
    <p>Configure real package rates, approved material options and explicit price rules. No Premium/Luxury rates, brands or material prices are assumed.</p>
    {notice && <p className="admin-notice" role="status">{notice}{viewLink && <> · <a href={viewLink} target="_blank" rel="noreferrer">Open secure quotation ↗</a></>}</p>}
    <div className="quote-admin-tabs">
      {(["pipeline", ...(canManagePricing ? ["packages", "materials"] as const : [])] as const).map((item) => <button className={tab === item ? "is-active" : ""} key={item} onClick={() => setTab(item)}>{item === "pipeline" ? "Quotation pipeline" : item === "packages" ? "Packages & terms" : "Material catalogue"}</button>)}
      <a className="quote-public-link" href="/quote" target="_blank" rel="noreferrer">Open customer estimator ↗</a>
    </div>

    {tab === "pipeline" && <>
      <div className="quote-admin-analytics">{totalTiles.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <div className="quote-create-toolbar"><span>Create and CRM-link a quote, or duplicate an existing version.</span><button className="btn" onClick={() => { setCreateOpen(true); setNewQuote({ ...emptyNewQuote, packageId: packages.find((item) => item.code === "ESSENTIAL")?.id || "" }); setViewLink(""); }}>Create quotation</button></div>
      <div className="crm-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Search failed.")); }} placeholder="Search quotation, customer or site" aria-label="Search quotations" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter quotation status"><option value="">All statuses</option>{statuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}</select>
        <button className="btn" onClick={() => load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Could not load quotations."))}>Search</button>
      </div>
      {quotes.length === 0 ? <div className="empty-state">No quotations match these filters. Public estimates will be linked to the customer CRM.</div> : quotes.map((item) => <article className="quote-admin-card" key={item.id}>
        <div className="quote-admin-card-head"><div><span className="section-index">{item.quotationNo} / {item.package.name.toUpperCase()}</span><h2>{item.customer.name}</h2><p>{item.customer.phone}{item.customer.email ? ` · ${item.customer.email}` : ""} · {item.siteLocation}</p></div><strong>{money(item.totalAmount)}</strong></div>
        <div className="quote-admin-meta"><span>{Number(item.constructionAreaSqFt).toLocaleString("en-IN")} sq. ft.</span><span>{money(item.applicableRatePerSqFt)} / sq. ft.</span><span>Revision history: {item._count.revisions}</span><span>{item.enquiry?.followUpAt ? `CRM follow-up ${new Date(item.enquiry.followUpAt).toLocaleDateString()}` : "No CRM follow-up set"}</span><span>{new Date(item.createdAt).toLocaleDateString()}</span></div>
        {item.items.length > 0 && <div className="quote-admin-items">{item.items.map((line, index) => <span key={`${line.categoryName}-${index}`}>{line.includedInPackage ? "Included" : "Additional selection"} · {line.categoryName}: {line.specificationName}{line.quality ? ` / ${gradeTitle(line.quality)}` : ""}{line.brand ? ` / ${line.brand}` : ""}</span>)}</div>}
        <div className="quote-admin-actions">
          <label>Status<select value={item.status} disabled={busy === item.id} onChange={(event) => updateStatus(item, event.target.value as QuoteStatus)}>{statuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          <a href={`/admin/quotations/${item.id}/print`} target="_blank" rel="noreferrer">Print / Save PDF ↗</a>
          <button onClick={() => beginRevision(item)}>Create revision</button>
          <button onClick={() => showHistory(item)}>Revision history ({item._count.revisions})</button>
          <button disabled={busy === item.id} onClick={() => duplicate(item)}>Duplicate</button>
          {item.status === "DRAFT" && <button className="quote-danger" onClick={() => remove(item)}>Delete draft</button>}
        </div>
      </article>)}
    </>}

    {tab === "packages" && <div className="quote-package-admin-list">{packages.map((item) => <section className="quote-package-admin" key={item.id}>
      <div className="quote-package-admin-title"><div><span className="section-index">{gradeTitle(item.quality)} / PACKAGE</span><h2>{item.name}</h2></div><span className={item.ratePerSqFt === null ? "quote-unconfigured" : "quote-configured"}>{item.ratePerSqFt === null ? "Rate not published" : `${money(item.ratePerSqFt)} / sq. ft.`}</span></div>
      <div className="quote-field-grid">
        <label>Administrator-approved rate / sq. ft.<input type="number" min="0.01" step="0.01" placeholder={item.ratePerSqFt === null ? "Configure before offering" : ""} value={item.ratePerSqFt || ""} onChange={(event) => updatePackage(item.id, "ratePerSqFt", event.target.value || null)} /></label>
        <label>GST rate (%)<input type="number" min="0" max="100" step="0.01" placeholder="Leave blank if not configured" value={item.gstRate || ""} onChange={(event) => updatePackage(item.id, "gstRate", event.target.value || null)} /></label>
        <label>Quotation validity (days)<input type="number" min="1" max="365" value={item.validityDays} onChange={(event) => updatePackage(item.id, "validityDays", Number(event.target.value))} /></label>
        <label className="quote-field-wide">Inclusions<textarea rows={3} value={item.inclusions} onChange={(event) => updatePackage(item.id, "inclusions", event.target.value)} placeholder="Only confirmed scope and inclusions" /></label>
        <label className="quote-field-wide">Exclusions<textarea rows={3} value={item.exclusions} onChange={(event) => updatePackage(item.id, "exclusions", event.target.value)} placeholder="Clearly list excluded work and charges" /></label>
        <label>Additional charges<textarea rows={3} value={chargesText[item.id] || ""} onChange={(event) => setChargesText((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={"Name|FIXED|amount\nName|PERCENT|amount"} /></label>
        <label>Payment milestones<textarea rows={3} value={milestonesText[item.id] || ""} onChange={(event) => setMilestonesText((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={"Milestone|percentage\nMilestone|percentage"} /></label>
      </div>
      <button className="btn" disabled={busy === item.id} onClick={() => savePackage(item)}>{busy === item.id ? "Saving…" : "Save package pricing & terms"}</button>
    </section>)}</div>}

    {tab === "materials" && <>
      <form className="quote-material-form" onSubmit={saveMaterial}>
        <div><span className="section-index">ADMIN-CONFIGURED ONLY</span><h2>{materialForm.id ? "Edit specification" : "Add a material specification"}</h2><p>Enter only approved product details. Brands and prices are not prefilled.</p></div>
        <div className="quote-field-grid">
          <label>Material category *<select required value={materialForm.categoryId} onChange={(event) => setMaterialForm({ ...materialForm, categoryId: event.target.value })}><option value="">Choose category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <label>Specification / product *<input required maxLength={160} value={materialForm.name} onChange={(event) => setMaterialForm({ ...materialForm, name: event.target.value })} placeholder="Approved specification name" /></label>
          <label>Quality grade<select value={materialForm.quality} onChange={(event) => setMaterialForm({ ...materialForm, quality: event.target.value as Grade })}><option value="ESSENTIAL">Essential</option><option value="PREMIUM">Premium</option><option value="LUXURY">Luxury</option></select></label>
          <label>Brand (optional; administrator verified)<input maxLength={120} value={materialForm.brand} onChange={(event) => setMaterialForm({ ...materialForm, brand: event.target.value })} placeholder="Leave blank unless confirmed" /></label>
          <label className="quote-field-wide">Specification details<textarea rows={2} maxLength={2000} value={materialForm.details} onChange={(event) => setMaterialForm({ ...materialForm, details: event.target.value })} placeholder="Model, grade, dimensions or source notes" /></label>
        </div>
        <button className="btn" disabled={busy === "material"}>{busy === "material" ? "Saving…" : materialForm.id ? "Save specification" : "Add specification"}</button>
      </form>
      {categories.map((category) => <section className="quote-category-admin" key={category.id}><div className="quote-category-heading"><h2>{category.name}</h2><span>{category.specifications.filter((item) => item.active).length} active options</span></div>
        {category.specifications.length === 0 ? <p className="quote-muted">No approved specifications entered.</p> : category.specifications.map((specification) => <article className={`quote-spec-admin ${!specification.active ? "is-inactive" : ""}`} key={specification.id}>
          <div className="quote-spec-title"><strong>{specification.name}</strong><span>{gradeTitle(specification.quality)}{specification.brand ? ` · ${specification.brand}` : ""}{specification.active ? "" : " · INACTIVE"}</span><p>{specification.details || "No details entered."}</p><button className="quote-text-button" onClick={() => setMaterialForm({ categoryId: category.id, id: specification.id, name: specification.name, quality: specification.quality, brand: specification.brand || "", details: specification.details })}>Edit</button><button className="quote-text-button" onClick={async () => { const response = await fetch("/api/admin/quotations/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", specificationId: specification.id, active: !specification.active }) }); const body = await response.json(); setNotice(response.ok ? `${specification.name} ${specification.active ? "deactivated" : "activated"}.` : body.error); await load(); }}>{specification.active ? "Deactivate" : "Activate"}</button></div>
          <div className="quote-spec-config">
            {packages.map((packageItem) => <div key={packageItem.id}>
              <label>Included in {packageItem.name}<select disabled={!specification.active} value={specification.defaultFor.some((item) => item.packageId === packageItem.id) ? specification.id : ""} onChange={(event) => setDefault(packageItem.id, category.id, event.target.value)}><option value="">Not included / no default</option><option value={specification.id}>{specification.name}</option></select></label>
              <label>Additional ₹ / sq. ft.<input type="number" min="0" step="0.01" disabled={!specification.active || specification.defaultFor.some((item) => item.packageId === packageItem.id)} value={ruleValues[`${packageItem.id}:${specification.id}`] ?? specification.pricingRules.find((rule) => rule.packageId === packageItem.id)?.adjustmentPerSqFt ?? ""} onChange={(event) => setRuleValues((current) => ({ ...current, [`${packageItem.id}:${specification.id}`]: event.target.value }))} placeholder="Set upgrade rule" /></label>
              <button disabled={!specification.active} onClick={() => saveRule(packageItem.id, specification)}>Save rule</button>
            </div>)}
          </div>
        </article>)}
      </section>)}
    </>}

    {revision && <div className="quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRevision(null); }}>
      <form className="quote-revision-modal" onSubmit={saveRevision}>
        <button className="quote-modal-close" type="button" onClick={() => setRevision(null)}>Close</button><div className="section-index">REVISION / {revision.quotationNo}</div><h2>Update estimate specifications</h2><p>The prior issued snapshot will remain in revision history. The calculation is revalidated against current administrator-configured prices.</p>
        <label>Construction package<select required value={revisionForm.packageId} onChange={(event) => { setRevisionForm({ ...revisionForm, packageId: event.target.value }); setRevisionPreview(null); }}><option value="">Select a configured package</option>{packages.map((item) => <option value={item.id} key={item.id}>{item.name} · {money(item.ratePerSqFt)} / sq. ft.</option>)}</select></label>
        <label>Construction area (sq. ft.)<input type="number" min="1" step="0.01" required value={revisionForm.area} onChange={(event) => { setRevisionForm({ ...revisionForm, area: event.target.value }); setRevisionPreview(null); }} /></label>
        <label>Property type<input required value={revisionForm.propertyType} onChange={(event) => setRevisionForm({ ...revisionForm, propertyType: event.target.value })} /></label>
        <label>Site location<input required value={revisionForm.siteLocation} onChange={(event) => setRevisionForm({ ...revisionForm, siteLocation: event.target.value })} /></label>
        <label>Plot area (sq. ft.)<input type="number" min="1" step="0.01" value={revisionForm.plotArea} onChange={(event) => setRevisionForm({ ...revisionForm, plotArea: event.target.value })} /></label>
        <label>Floors<input type="number" min="1" max="100" step="1" value={revisionForm.floors} onChange={(event) => setRevisionForm({ ...revisionForm, floors: event.target.value })} /></label>
        <label className="quote-field-wide">Requirements<textarea rows={3} value={revisionForm.requirements} onChange={(event) => setRevisionForm({ ...revisionForm, requirements: event.target.value })} /></label>
        {categories.filter((category) => category.specifications.some((item) => item.active)).map((category) => <label key={category.id}>{category.name}<select value={revisionForm.selections[category.id] || ""} onChange={(event) => { setRevisionForm({ ...revisionForm, selections: { ...revisionForm.selections, [category.id]: event.target.value } }); setRevisionPreview(null); }}><option value="">No selected specification</option>{category.specifications.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {gradeTitle(item.quality)}</option>)}</select></label>)}
        <p>Other contact information is retained as recorded on the original quotation. The displayed change is compared with the current saved version.</p>
        <button type="button" className="btn btn-dark" disabled={!revisionForm.packageId || !revisionForm.area || busy === "revision-preview"} onClick={previewRevision}>{busy === "revision-preview" ? "Calculating…" : "Preview revised estimate"}</button>
        {revisionPreview && <div className="quote-modal-estimate"><strong>{money(revisionPreview.totalAmount)} revised estimate</strong><span>{money(revisionPreview.applicableRatePerSqFt)} / sq. ft.</span><small>Change from current saved quotation: {revisionPreview.totalAmount >= Number(revision.totalAmount) ? "+" : "−"}{money(Math.abs(revisionPreview.totalAmount - Number(revision.totalAmount)))}</small>{revisionPreview.items.filter((item) => !item.includedInPackage).map((item) => <small key={`${item.categoryName}-${item.specificationName}`}>{item.abovePackageGrade ? "Grade upgrade" : "Additional selection"} · {item.categoryName}: {item.specificationName} · +{money(item.adjustmentPerSqFt)} / sq. ft.</small>)}{revisionPreview.items.some((item) => !item.includedInPackage) && <label className="quote-confirm"><input type="checkbox" checked={confirmRevisionUpgrades} onChange={(event) => setConfirmRevisionUpgrades(event.target.checked)} /> Confirm the itemised material selections and their displayed price impact.</label>}</div>}
        <button className="btn" disabled={!revisionPreview || Boolean(revisionPreview.items.some((item) => !item.includedInPackage) && !confirmRevisionUpgrades)}>Save revision with prior version retained</button>
      </form>
    </div>}
    {historyQuote && <div className="quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryQuote(null); }}>
      <section className="quote-revision-modal">
        <button className="quote-modal-close" type="button" onClick={() => setHistoryQuote(null)}>Close</button><div className="section-index">AUDIT / IMMUTABLE SNAPSHOTS</div><h2>Revision history · {historyQuote.quotationNo}</h2><p>Each saved entry preserves the preceding quotation data and itemised specification for audit.</p>
        {revisionRecords.length === 0 ? <p>No saved revisions.</p> : revisionRecords.map((record) => <article className="quote-history-entry" key={record.revision}>
          <strong>Revision {record.revision}</strong><span>{new Date(record.createdAt).toLocaleString()} · {record.actorEmail}</span>
          <details><summary>Inspect preserved quotation snapshot</summary><pre>{JSON.stringify(record.snapshot, null, 2)}</pre></details>
        </article>)}
      </section>
    </div>}
    {createOpen && <div className="quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
      <form className="quote-revision-modal" onSubmit={createQuotation}>
        <button className="quote-modal-close" type="button" onClick={() => setCreateOpen(false)}>Close</button><div className="section-index">CRM / NEW ESTIMATE</div><h2>Create a customer quotation</h2><p>Customer details are matched to an existing CRM enquiry by phone or email where possible. Prices are recalculated on the server.</p>
        <div className="quote-field-grid">
          <label>Customer name *<input required minLength={2} maxLength={100} value={newQuote.name} onChange={(event) => { setNewQuote({ ...newQuote, name: event.target.value }); setNewQuoteEstimate(null); }} /></label>
          <label>Phone number *<input required minLength={8} maxLength={24} pattern="[0-9+\(\) .\-]{8,24}" value={newQuote.phone} onChange={(event) => { setNewQuote({ ...newQuote, phone: event.target.value }); setNewQuoteEstimate(null); }} /></label>
          <label>Email<input type="email" maxLength={254} value={newQuote.email} onChange={(event) => { setNewQuote({ ...newQuote, email: event.target.value }); setNewQuoteEstimate(null); }} /></label>
          <label>Property type *<input required value={newQuote.propertyType} onChange={(event) => { setNewQuote({ ...newQuote, propertyType: event.target.value }); setNewQuoteEstimate(null); }} /></label>
          <label className="quote-field-wide">Site location *<input required value={newQuote.siteLocation} onChange={(event) => { setNewQuote({ ...newQuote, siteLocation: event.target.value }); setNewQuoteEstimate(null); }} /></label>
          <label>Construction area (sq. ft.) *<input required type="number" min="1" step="0.01" value={newQuote.area} onChange={(event) => { setNewQuote({ ...newQuote, area: event.target.value }); setNewQuoteEstimate(null); }} /></label>
          <label>Package *<select required value={newQuote.packageId} onChange={(event) => { setNewQuote({ ...newQuote, packageId: event.target.value }); setNewQuoteEstimate(null); }}>{packages.map((item) => <option value={item.id} key={item.id}>{item.name} · {money(item.ratePerSqFt)} / sq. ft.</option>)}</select></label>
          <label>Plot area (sq. ft.)<input type="number" min="1" step="0.01" value={newQuote.plotArea} onChange={(event) => setNewQuote({ ...newQuote, plotArea: event.target.value })} /></label>
          <label>Number of floors<input type="number" min="1" max="100" step="1" value={newQuote.floors} onChange={(event) => setNewQuote({ ...newQuote, floors: event.target.value })} /></label>
          <label className="quote-field-wide">Requirements<textarea rows={2} maxLength={5000} value={newQuote.requirements} onChange={(event) => setNewQuote({ ...newQuote, requirements: event.target.value })} /></label>
          {categories.filter((category) => category.specifications.some((item) => item.active)).map((category) => <label key={category.id}>{category.name}<select value={newQuote.selections[category.id] || ""} onChange={(event) => { setNewQuote({ ...newQuote, selections: { ...newQuote.selections, [category.id]: event.target.value } }); setNewQuoteEstimate(null); }}><option value="">Use package default / discuss</option>{category.specifications.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.name} · {gradeTitle(item.quality)}</option>)}</select></label>)}
        </div>
        <button type="button" className="btn btn-dark" disabled={!newQuote.packageId || !newQuote.area || busy === "new-quote-preview"} onClick={previewNewQuote}>{busy === "new-quote-preview" ? "Calculating…" : "Preview server-calculated estimate"}</button>
        {newQuoteEstimate && <div className="quote-modal-estimate"><strong>{money(newQuoteEstimate.totalAmount)} indicative total</strong><span>{money(newQuoteEstimate.applicableRatePerSqFt)} / sq. ft.</span>{newQuoteEstimate.items.filter((item) => !item.includedInPackage).map((item) => <small key={`${item.categoryName}-${item.specificationName}`}>{item.abovePackageGrade ? "Grade upgrade" : "Additional selection"} · {item.categoryName}: {item.specificationName} · +{money(item.adjustmentPerSqFt)} / sq. ft.</small>)}{newQuoteEstimate.items.some((item) => !item.includedInPackage) && <label className="quote-confirm"><input type="checkbox" checked={confirmNewQuoteUpgrades} onChange={(event) => setConfirmNewQuoteUpgrades(event.target.checked)} /> Confirm the itemised material selections and their displayed price impact.</label>}</div>}
        <button className="btn" disabled={!newQuoteEstimate || busy === "new-quote-create" || Boolean(newQuoteEstimate.items.some((item) => !item.includedInPackage) && !confirmNewQuoteUpgrades)}>{busy === "new-quote-create" ? "Creating…" : "Create quotation and CRM record"}</button>
      </form>
    </div>}
  </main>;
}
