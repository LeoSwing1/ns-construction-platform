"use client";

import { useEffect, useState } from "react";

type Post = { id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string | null; category: string; tags: string[]; seoTitle: string | null; seoDescription: string | null; status: "DRAFT" | "SCHEDULED" | "PUBLISHED"; publishedAt: string | null };
type Draft = { title: string; slug: string; excerpt: string; content: string; coverImage: string; category: string; tags: string; seoTitle: string; seoDescription: string; status: "DRAFT" | "PUBLISHED" };
const empty: Draft = { title: "", slug: "", excerpt: "", content: "", coverImage: "", category: "Construction Advice", tags: "", seoTitle: "", seoDescription: "", status: "DRAFT" };

export default function BlogAdmin() {
  const [items, setItems] = useState<Post[]>([]);
  const [form, setForm] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/blog");
    if (response.status === 401) { location.href = "/admin/login"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load articles.");
    setItems(result);
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load articles.")); }, []);

  function edit(post: Post) {
    setEditing(post.id);
    setForm({ title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, coverImage: post.coverImage || "", category: post.category, tags: post.tags.join(", "), seoTitle: post.seoTitle || "", seoDescription: post.seoDescription || "", status: post.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Saving article…");
    const payload = { ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), coverImage: form.coverImage || (editing ? null : "") };
    const response = await fetch(editing ? `/api/admin/blog/${editing}` : "/api/admin/blog", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) { setMessage(typeof result.error === "string" ? result.error : "Check article fields and its unique slug."); return; }
    setItems((current) => editing ? current.map((item) => item.id === editing ? result : item) : [result, ...current]);
    setForm(empty);
    setEditing(null);
    setMessage(form.status === "PUBLISHED" ? "Article published." : "Draft saved.");
  }

  async function changeStatus(post: Post) {
    const status = post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const response = await fetch(`/api/admin/blog/${post.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Publication status could not be updated."); return; }
    setItems((current) => current.map((item) => item.id === post.id ? result : item));
    setMessage(status === "PUBLISHED" ? "Article published." : "Article unpublished.");
  }

  async function remove(post: Post) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/blog/${post.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Article could not be deleted."); return; }
    setItems((current) => current.filter((item) => item.id !== post.id));
    setMessage("Article deleted.");
  }

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">CONTENT / JOURNAL</div><h1>Editorial desk</h1>
    <p>Write reviewed project guidance. Drafts are private; published articles are available on the public journal.</p>
    <form className="admin-form" onSubmit={save}>
      <label>Title<input required minLength={5} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>URL slug<input required pattern="[a-z0-9-]+" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
      <label>Category<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
      <label>Cover image URL<input type="url" value={form.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} /></label>
      <label className="field-full">Excerpt<textarea required rows={2} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></label>
      <label className="field-full">Article content<textarea required rows={10} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
      <label>Tags (comma-separated)<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label>
      <label>SEO title<input value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} /></label>
      <label className="field-full">SEO description<input value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} /></label>
      <label>Publication<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Draft["status"] })}><option value="DRAFT">Save as draft</option><option value="PUBLISHED">Publish now</option></select></label>
      <div className="field-full admin-actions"><button className="btn">{editing ? "Save changes" : "Save article"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel editing</button>}</div>
      {message && <span className="admin-notice" role="status">{message}</span>}
    </form>
    <h2>Articles ({items.length})</h2>
    {items.map((post) => <article className="admin-record" key={post.id}><div><strong>{post.title}</strong><p>{post.category} · {post.status}{post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleDateString()}` : ""}</p><small>{post.slug}</small></div><div className="admin-actions"><button onClick={() => edit(post)}>Edit</button><button onClick={() => changeStatus(post)}>{post.status === "PUBLISHED" ? "Unpublish" : "Publish"}</button>{post.status === "PUBLISHED" && <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">Preview ↗</a>}<button onClick={() => remove(post)}>Delete</button></div></article>)}
  </main>;
}
