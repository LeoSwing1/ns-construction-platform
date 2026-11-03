"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Summary = {
  projects: number;
  posts: number;
  role: "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "SALES";
  canViewLeads: boolean;
  enquiries: number | null;
  newEnquiries: number | null;
  publishedPosts: number;
  followUpsDue: number | null;
  deliveryIssues: number | null;
  recent: { id: string; name: string; phone: string; projectType: string; status: string; createdAt: string }[];
  quotationCount: number | null;
  draftQuotations: number | null;
  sentQuotations: number | null;
  acceptedQuotations: number | null;
  rejectedQuotations: number | null;
  quotationValue: string | null;
  recentQuotations: { id: string; quotationNo: string; totalAmount: string; status: string; createdAt: string; customer: { name: string } }[];
};

export default function Admin() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/summary")
      .then(async (response) => {
        if (response.status === 401) {
          location.href = "/admin/login";
          return null;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load dashboard.");
        return result as Summary;
      })
      .then((result) => {
        if (active && result) setData(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function logout() {
    const response = await fetch("/api/admin/logout", { method: "POST" });
    if (response.ok) location.href = "/admin/login";
    else setError("Sign out failed. Please try again.");
  }

  const tiles = data ? [
    ["Projects", data.projects],
    ["All blog posts", data.posts],
    ["Published articles", data.publishedPosts],
    ...(data.canViewLeads ? [
      ["Total enquiries", data.enquiries ?? 0],
      ["New enquiries", data.newEnquiries ?? 0],
      ["Follow-ups due", data.followUpsDue ?? 0],
      ["Email delivery issues", data.deliveryIssues ?? 0],
      ["Quotations", data.quotationCount ?? 0],
      ["Draft quotations", data.draftQuotations ?? 0],
      ["Sent quotations", data.sentQuotations ?? 0],
      ["Accepted quotations", data.acceptedQuotations ?? 0],
      ["Rejected quotations", data.rejectedQuotations ?? 0],
    ] as const : []),
  ] as const : [];

  return (
    <main className="admin-shell">
      <div className="admin-wrap">
        <header className="admin-header">
          <div>
            <div className="eyebrow">N.S. CONSTRUCTION / CONTROL ROOM</div>
            <h1>Good work starts with a clear view.</h1>
            <p>Manage your projects, articles and customer relationships.</p>
          </div>
          <button className="btn btn-dark" onClick={logout}>Sign out</button>
        </header>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {loading ? (
          <div className="admin-tiles" aria-label="Loading dashboard">
            {Array.from({ length: 6 }, (_, index) => <div className="skeleton-tile" key={index} />)}
          </div>
        ) : !data ? (
          <section className="admin-empty">
            <h2>Dashboard data could not be loaded</h2>
            <p>{error || "Check the database connection and migration status, then try again."}</p>
            <button className="btn" onClick={() => location.reload()}>Retry</button>
          </section>
        ) : (
          <>
            <div className="admin-tiles">
              {tiles.map(([label, value]) => <article className="admin-tile" key={label}>
                <span>{label}</span><strong>{value}</strong>
              </article>)}
            </div>
            {data.canViewLeads && <section className="admin-panel">
              <div className="admin-panel-heading">
                <div><div className="eyebrow">CUSTOMER RELATIONSHIPS</div><h2>Recent enquiries</h2></div>
                <a className="text-link" href="/admin/enquiries">Open CRM ↗</a>
              </div>
              {data.recent.length === 0 ? <p className="empty-copy">No enquiries received yet. New project requests will appear here.</p> : (
                <div className="table-scroll"><table className="admin-table">
                  <thead><tr>{["Name", "Phone", "Project", "Status", "Received"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
                  <tbody>{data.recent.map((item) => <tr key={item.id}>
                    <td>{item.name}</td><td>{item.phone}</td><td>{item.projectType}</td><td><span className="status-pill">{item.status}</span></td><td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>)}</tbody>
                </table></div>
              )}
            </section>}
            {data.canViewLeads && <section className="admin-panel">
              <div className="admin-panel-heading">
                <div><div className="eyebrow">ESTIMATION / PIPELINE</div><h2>Recent quotations</h2></div>
                <div><strong>Indicative value: {data.quotationValue ? `₹${Number(data.quotationValue).toLocaleString("en-IN")}` : "—"}</strong> · <a className="text-link" href="/admin/quotations">Manage quotations ↗</a></div>
              </div>
              {data.recentQuotations.length === 0 ? <p className="empty-copy">No quotations yet. Configured estimates will appear here alongside linked CRM activity.</p> : (
                <div className="table-scroll"><table className="admin-table">
                  <thead><tr>{["Quotation", "Customer", "Indicative value", "Status", "Created"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
                  <tbody>{data.recentQuotations.map((item) => <tr key={item.id}>
                    <td>{item.quotationNo}</td><td>{item.customer.name}</td><td>₹{Number(item.totalAmount).toLocaleString("en-IN")}</td><td><span className="status-pill">{item.status.replaceAll("_", " ")}</span></td><td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>)}</tbody>
                </table></div>
              )}
            </section>}
            <section className="admin-links" aria-label="Admin tools">
              {data.role !== "SALES" && <a className="admin-link-card" href="/admin/projects"><span>01</span><strong>Projects</strong><small>Manage case studies and galleries</small></a>}
              {data.role !== "SALES" && <a className="admin-link-card" href="/admin/blog"><span>02</span><strong>Editorial</strong><small>Create and publish articles</small></a>}
              {data.canViewLeads && <a className="admin-link-card" href="/admin/enquiries"><span>03</span><strong>Enquiry CRM</strong><small>Track leads and follow-ups</small></a>}
              {data.canViewLeads && <a className="admin-link-card" href="/admin/quotations"><span>10</span><strong>Quotations & pricing</strong><small>Packages, materials, rates and revisions</small></a>}
              {data.role !== "SALES" && <a className="admin-link-card" href="/admin/media"><span>04</span><strong>Media library</strong><small>Secure project image storage</small></a>}
              {(data.role === "SUPER_ADMIN" || data.role === "ADMIN") && <a className="admin-link-card" href="/admin/integrations"><span>05</span><strong>Integrations</strong><small>Review setup and health status</small></a>}
              {(data.role === "SUPER_ADMIN" || data.role === "ADMIN") && <a className="admin-link-card" href="/admin/team"><span>06</span><strong>Team & roles</strong><small>Manage staff access</small></a>}
              {data.role !== "SALES" && <a className="admin-link-card" href="/admin/testimonials"><span>07</span><strong>Testimonials</strong><small>Approve verified customer feedback</small></a>}
              {(data.role === "SUPER_ADMIN" || data.role === "ADMIN") && <a className="admin-link-card" href="/admin/settings"><span>08</span><strong>Website settings</strong><small>Update public contact details</small></a>}
              {data.canViewLeads && <a className="admin-link-card" href="/admin/notifications"><span>09</span><strong>Notifications</strong><small>Due follow-ups and delivery issues</small></a>}
              <Link className="admin-link-card" href="/"><span>↗</span><strong>Public website</strong><small>Preview the customer experience</small></Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
