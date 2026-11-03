"use client";

import { useEffect, useState } from "react";

type Testimonial = { id: string; customerName: string; attribution: string | null; quote: string; verified: boolean; published: boolean };
export default function TestimonialsAdmin() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [form, setForm] = useState({ customerName: "", attribution: "", quote: "", verified: false, published: false });
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/testimonials");
    if (response.status === 401) { location.href = "/admin/login"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load testimonials.");
    setItems(result);
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load testimonials.")); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/testimonials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Feedback could not be saved."); return; }
    setItems((current) => [result, ...current]);
    setForm({ customerName: "", attribution: "", quote: "", verified: false, published: false });
    setMessage("Customer feedback saved.");
  }

  async function update(item: Testimonial, change: Partial<Testimonial>) {
    const response = await fetch(`/api/admin/testimonials/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Feedback could not be updated."); return; }
    setItems((current) => current.map((entry) => entry.id === item.id ? result : entry));
    setMessage("Customer feedback updated.");
  }

  async function remove(item: Testimonial) {
    if (!window.confirm(`Delete feedback from ${item.customerName}?`)) return;
    const response = await fetch(`/api/admin/testimonials/${item.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Feedback could not be deleted."); return; }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setMessage("Feedback deleted.");
  }

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">CONTENT / CUSTOMER FEEDBACK</div><h1>Testimonials</h1>
    <p>Only publish customer feedback that has been received with permission and reviewed. No sample testimonials are preloaded.</p>
    <form className="admin-form" onSubmit={create}>
      <label>Customer name<input required minLength={2} maxLength={100} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label>
      <label>Attribution (optional)<input maxLength={160} value={form.attribution} onChange={(event) => setForm({ ...form, attribution: event.target.value })} placeholder="Project or locality, if approved" /></label>
      <label className="field-full">Exact customer feedback<textarea required minLength={10} maxLength={1500} rows={5} value={form.quote} onChange={(event) => setForm({ ...form, quote: event.target.value })} /></label>
      <label><input type="checkbox" checked={form.verified} onChange={(event) => setForm({ ...form, verified: event.target.checked })} /> Confirmed genuine and approved for publication</label>
      <label><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publish on website</label>
      <button className="btn">Save feedback</button>{message && <span className="admin-notice" role="status">{message}</span>}
    </form>
    {items.map((item) => <article className="admin-record testimonial-admin-card" key={item.id}>
      <div><strong>{item.customerName}{item.attribution ? ` · ${item.attribution}` : ""}</strong><p>{item.quote}</p><small>{item.verified ? "Verified" : "Unverified"} · {item.published ? "Published" : "Not published"}</small></div>
      <div className="admin-actions"><button disabled={item.published && !item.verified} onClick={() => update(item, { verified: !item.verified })}>{item.verified ? "Mark unverified" : "Verify feedback"}</button><button onClick={() => update(item, { published: !item.published })}>{item.published ? "Unpublish" : "Publish"}</button><button onClick={() => remove(item)}>Delete</button></div>
    </article>)}
    {items.length === 0 && <div className="empty-state">No customer feedback has been added.</div>}
  </main>;
}
