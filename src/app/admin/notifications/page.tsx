"use client";

import { useEffect, useState } from "react";

type Notice = { id: string; name: string; phone: string; email: string | null; projectType: string; status: string; followUpAt: string | null; emailDeliveryStatus: string; emailAttempts: number; updatedAt: string };
export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/notifications");
    if (response.status === 401) { location.href = "/admin/login"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load notifications.");
    setItems(result);
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load notifications.")); }, []);

  async function retry(item: Notice) {
    const response = await fetch(`/api/admin/enquiries/${item.id}/email`, { method: "POST" });
    const result = await response.json();
    setMessage(response.ok ? `Delivery retry: ${result.status}.` : result.error || "Could not retry email delivery.");
    await load();
  }

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">OPERATIONS / FOLLOW-UP</div><h1>Notification centre</h1>
    <p>Due lead follow-ups and unsuccessful email notifications. No automatic reminders are sent; follow-up timing is managed by the CRM team.</p>
    {message && <p className="admin-notice" role="status">{message}</p>}
    {items.length === 0 ? <div className="empty-state">No follow-ups are due and no delivery failures are awaiting action.</div> : items.map((item) => <article className="admin-record" key={item.id}>
      <div><strong>{item.name} · {item.projectType}</strong><p>{item.phone}{item.email ? ` · ${item.email}` : ""} · Lead stage: {item.status}</p>
        <small>{item.followUpAt && new Date(item.followUpAt) <= new Date() ? `Follow-up due ${new Date(item.followUpAt).toLocaleString()}` : ""}{item.emailDeliveryStatus === "FAILED" || item.emailDeliveryStatus === "PARTIAL" ? ` · Email ${item.emailDeliveryStatus.toLowerCase()} after ${item.emailAttempts} attempt(s)` : ""}</small>
      </div>
      <div className="admin-actions"><a href="/admin/enquiries">Open CRM ↗</a>{item.emailDeliveryStatus !== "SENT" && <button onClick={() => retry(item)}>Retry email</button>}</div>
    </article>)}
  </main>;
}
