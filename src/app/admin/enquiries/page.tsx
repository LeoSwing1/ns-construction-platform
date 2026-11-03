"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Activity = { id: string; action: string; details: string | null; actorEmail: string; createdAt: string };
type User = { id: string; name: string; email: string; role: string };
type Lead = {
  id: string; name: string; phone: string; email: string | null; projectType: string; location: string | null; projectArea: string | null; floors: number | null;
  budget: string | null; services: string[]; timeline: string | null; message: string | null; documents: string[]; status: string; followUpAt: string | null;
  emailDeliveryStatus: string; emailAttempts: number; assignedTo: User | null; activities: Activity[]; createdAt: string;
};
const statuses = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"];

export default function EnquiriesAdmin() {
  const [items, setItems] = useState<Lead[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [followUpsOnly, setFollowUpsOnly] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("q", search.trim());
    if (statusFilter) query.set("status", statusFilter);
    const response = await fetch(`/api/admin/enquiries?${query.toString()}`);
    if (response.status === 401) { location.href = "/admin/login"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load enquiries.");
    setItems(result);
  }, [search, statusFilter]);

  useEffect(() => { load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load enquiries.")); }, [load]);
  useEffect(() => {
    fetch("/api/admin/users").then(async (response) => {
      if (response.ok) setTeam(await response.json());
      else if (response.status !== 403) {
        const result = await response.json();
        throw new Error(result.error || "Team assignments could not be loaded.");
      }
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Team assignments could not be loaded."));
  }, []);

  const visible = useMemo(() => items.filter((item) => !followUpsOnly || Boolean(item.followUpAt && new Date(item.followUpAt).getTime() <= Date.now())), [items, followUpsOnly]);
  function localDateTime(value: string) {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  async function update(id: string, change: { status?: string; assignedToId?: string | null; followUpAt?: string | null; note?: string }) {
    setBusy(id);
    const response = await fetch("/api/admin/enquiries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...change }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Could not update enquiry."); setBusy(""); return; }
    setNotes((current) => ({ ...current, [id]: "" }));
    await load();
    setError("Enquiry updated. The CRM activity history has been recorded.");
    setBusy("");
  }

  async function retryEmail(item: Lead) {
    setBusy(item.id);
    const response = await fetch(`/api/admin/enquiries/${item.id}/email`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Could not retry email delivery.");
    else setError(`Notification retry completed: ${result.status}.`);
    await load();
    setBusy("");
  }

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">CUSTOMER RELATIONSHIPS / PIPELINE</div><h1>Enquiry CRM</h1>
    <p>Search leads, track the pipeline, assign ownership, set follow-up reminders and keep a time-stamped activity record.</p>
    <div className="crm-filters">
      <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Search failed.")); }} placeholder="Search customer, phone or location" aria-label="Search enquiries" />
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by lead stage"><option value="">All stages</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
      <button className="btn" onClick={() => load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load enquiries."))}>Search</button>
      <label className="follow-up-filter"><input type="checkbox" checked={followUpsOnly} onChange={(event) => setFollowUpsOnly(event.target.checked)} /> Follow-ups due</label>
    </div>
    {error && <p className="admin-notice" role="status">{error}</p>}
    {visible.length === 0 ? <div className="empty-state">No enquiries match these filters. New consultation requests will appear here automatically.</div> :
      visible.map((item) => <article className="crm-card" key={item.id}>
        <div className="crm-card-heading"><div><span className="section-index">{item.status} / RECEIVED {new Date(item.createdAt).toLocaleDateString()}</span><h2>{item.name}</h2></div><span className={`delivery-pill delivery-${item.emailDeliveryStatus.toLowerCase()}`}>Email {item.emailDeliveryStatus}</span></div>
        <p><a href={`tel:${item.phone}`}>{item.phone}</a>{item.email ? <> · <a href={`mailto:${item.email}`}>{item.email}</a></> : null}</p>
        <div className="lead-detail-grid">
          <div><span>Project</span><strong>{item.projectType}</strong></div><div><span>Site</span><strong>{item.location || "Not provided"}</strong></div>
          <div><span>Scale</span><strong>{[item.projectArea, item.floors ? `${item.floors} floors` : ""].filter(Boolean).join(" · ") || "Not provided"}</strong></div>
          <div><span>Budget / timeline</span><strong>{item.budget || "Not provided"} · {item.timeline || "Not provided"}</strong></div>
          <div className="field-full"><span>Services requested</span><strong>{item.services.length ? item.services.join(", ") : "To be discussed"}</strong></div>
          {item.message && <div className="field-full"><span>Requirements</span><strong>{item.message}</strong></div>}
        </div>
        {item.documents.length > 0 && <div className="lead-attachments"><span>ATTACHMENTS</span>{item.documents.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={`${url}-${index}`}>Project file {index + 1} ↗</a>)}</div>}
        <div className="crm-controls">
          <label>Pipeline stage<select disabled={busy === item.id} value={item.status} onChange={(event) => update(item.id, { status: event.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Assigned to<select disabled={busy === item.id} value={item.assignedTo?.id || ""} onChange={(event) => update(item.id, { assignedToId: event.target.value || null })}><option value="">Unassigned</option>{team.map((user) => <option value={user.id} key={user.id}>{user.name} · {user.role}</option>)}</select></label>
          <label>Follow-up reminder<input disabled={busy === item.id} type="datetime-local" value={item.followUpAt ? localDateTime(item.followUpAt) : ""} onChange={(event) => update(item.id, { followUpAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
        </div>
        <div className="note-entry"><input value={notes[item.id] || ""} maxLength={2000} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} placeholder="Add a private CRM note" aria-label={`Add note for ${item.name}`} /><button disabled={!notes[item.id]?.trim() || busy === item.id} onClick={() => update(item.id, { note: notes[item.id].trim() })}>Add note</button></div>
        <div className="crm-card-actions">{item.emailDeliveryStatus !== "SENT" && <button onClick={() => retryEmail(item)} disabled={busy === item.id}>Retry email notification</button>}{item.assignedTo && <small>Owner: {item.assignedTo.name}</small>}</div>
        {item.activities.length > 0 && <details className="crm-activity"><summary>Activity history ({item.activities.length})</summary>{item.activities.map((activity) => <p key={activity.id}><strong>{activity.action.replaceAll("_", " ")}</strong> · {activity.details} · {activity.actorEmail} · {new Date(activity.createdAt).toLocaleString()}</p>)}</details>}
      </article>)}
  </main>;
}
