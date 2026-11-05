"use client";

import { useEffect, useState } from "react";

type Report = {
  month: string;
  totals: { directCosts: number; labourAccrual: number; receivedProcurement: number; accruedProjectCosts: number; customerCollections: number; contractorCashPaid: number; collectionsLessContractorPayments: number; costsByCategory: Record<string, number> };
  jobs: { id: string; jobNo: string; name: string; contractValue: number; approvedBudget: number; directCosts: number; procurementReceived: number; approvedLabour: number; actualCost: number; projectContribution: number; collected: number; customerOutstanding: number }[];
};
const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function OperationsReportsPage() {
  const [month, setMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`; });
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    fetch(`/api/admin/operations/reports?month=${month}`, { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load report."); return data as Report; })
      .then((data) => { if (live) setReport(data); })
      .catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [month]);
  return <main className="admin-shell"><div className="admin-wrap">
    <header className="admin-header"><div><div className="eyebrow">N.S. CONSTRUCTION / FINANCE</div><h1>Monthly financial reports</h1><p>Project contribution, recognised costs, customer collections and contractor cash payments.</p></div><a className="btn btn-dark" href="/admin/operations">Back to operations</a></header>
    <section className="admin-panel"><div className="operations-report-toolbar"><label>Reporting month<input className="form-input" type="month" value={month} onChange={(e)=>setMonth(e.target.value)}/></label><span>{loading ? "Generating report…" : "Month selected · India reporting currency INR"}</span></div>
      {error && <div className="notice notice-error">{error}</div>}
      {report && <>
        <div className="admin-tiles">{[["Direct costs",money(report.totals.directCosts)],["Labour accrual",money(report.totals.labourAccrual)],["Received procurement",money(report.totals.receivedProcurement)],["Accrued project costs",money(report.totals.accruedProjectCosts)],["Customer collections",money(report.totals.customerCollections)],["Contractor cash paid",money(report.totals.contractorCashPaid)],["Collections less contractor payments",money(report.totals.collectionsLessContractorPayments)]].map(([label,value])=><article className="admin-tile" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
        <section className="operations-report-section"><h2>Monthly cost breakdown</h2><div className="table-scroll"><table className="admin-table"><thead><tr><th>Cost category</th><th>Recorded amount</th></tr></thead><tbody>{Object.entries(report.totals.costsByCategory).filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]).map(([category,value])=><tr key={category}><td>{category.replaceAll("_"," ")}</td><td>{money(value)}</td></tr>)}</tbody></table></div></section>
        <section className="operations-report-section"><h2>Project-wise lifetime cost & contribution</h2><p className="empty-copy">This is an operational contribution view: approved contract value less recorded lifetime costs. It is not a statutory accrual-accounting profit-and-loss statement. Monthly customer collections and contractor payments are shown separately above.</p><div className="table-scroll"><table className="admin-table"><thead><tr><th>Project</th><th>Contract</th><th>Budget</th><th>Direct</th><th>Procurement</th><th>Labour</th><th>Actual cost</th><th>Contribution</th><th>Collected</th><th>Outstanding</th></tr></thead><tbody>{report.jobs.map((job)=><tr key={job.id}><td>{job.jobNo}<small>{job.name}</small></td><td>{money(job.contractValue)}</td><td>{money(job.approvedBudget)}</td><td>{money(job.directCosts)}</td><td>{money(job.procurementReceived)}</td><td>{money(job.approvedLabour)}</td><td>{money(job.actualCost)}</td><td>{money(job.projectContribution)}</td><td>{money(job.collected)}</td><td>{money(job.customerOutstanding)}</td></tr>)}</tbody></table></div></section>
        <div className="operations-report-footer"><span>Prepared for internal management · {report.month}</span><button className="btn btn-dark" type="button" onClick={()=>window.print()}>Print / Save monthly report</button></div>
      </>}
    </section>
  </div></main>;
}
