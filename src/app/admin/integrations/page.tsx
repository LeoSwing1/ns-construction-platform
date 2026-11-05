"use client";

import { useEffect, useState } from "react";

type Integration = { id: string; name: string; state: string; detail: string };
export default function IntegrationsPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/integrations").then(async (response) => {
      if (response.status === 401) { location.href = "/admin/login"; return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load integrations.");
      setItems(result);
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load integrations."));
  }, []);

  async function test(integration: "resend" | "cloudinary" | "whatsapp" | "google-sheets") {
    setMessage(`Testing ${integration}…`);
    const response = await fetch("/api/admin/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integration }) });
    const result = await response.json();
    setMessage(response.ok ? result.message : result.error || "Connection test failed.");
  }

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">OPERATIONS / CONNECTION STATUS</div><h1>Integration desk</h1>
    <p>Configuration is not the same as a verified connection. Tests validate provider access; WhatsApp testing does not send a message, and the Google Sheets test event is designed not to add a lead row.</p>
    {message && <div className="admin-notice" role="status">{message}</div>}
    <div className="integration-list">{items.map((item) => <article className="integration-card" key={item.id}>
      <div><span className="section-index">{item.id.toUpperCase()}</span><h2>{item.name}</h2><p>{item.detail}</p></div>
      <div className="integration-action"><strong>{item.state}</strong>{["resend", "cloudinary", "whatsapp", "google-sheets"].includes(item.id) && <button className="btn" onClick={() => test(item.id as "resend" | "cloudinary" | "whatsapp" | "google-sheets")}>Test connection</button>}</div>
    </article>)}</div>
  </main>;
}
