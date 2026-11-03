"use client";

import { useEffect, useState } from "react";

type Project = { id: string; title: string; slug: string; category: string; location: string; year: number | null; summary: string; description: string; coverImage: string | null; gallery: string[]; featured: boolean; published: boolean };
type Draft = Omit<Project, "id">;
const empty: Draft = { title: "", slug: "", category: "Residential", location: "", year: null, summary: "", description: "", coverImage: null, gallery: [], featured: false, published: true };

export default function ProjectsAdmin() {
  const [items, setItems] = useState<Project[]>([]);
  const [form, setForm] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [galleryText, setGalleryText] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/projects");
    if (response.status === 401) { location.href = "/admin/login"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load projects.");
    setItems(result);
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load projects.")); }, []);

  function edit(project: Project) {
    const { id, ...draft } = project;
    setEditing(id);
    setForm(draft);
    setGalleryText(project.gallery.join("\n"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Saving project…");
    const payload = {
      ...form,
      year: form.year || undefined,
      coverImage: form.coverImage || (editing ? null : ""),
      gallery: galleryText.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
    };
    const response = await fetch(editing ? `/api/admin/projects/${editing}` : "/api/admin/projects", {
      method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) { setMessage(typeof result.error === "string" ? result.error : "Check the project details and image URLs."); return; }
    setItems((current) => editing ? current.map((item) => item.id === editing ? result : item) : [result, ...current]);
    setForm(empty);
    setGalleryText("");
    setEditing(null);
    setMessage("Project saved.");
  }

  async function update(project: Project, changes: Partial<Project>) {
    const response = await fetch(`/api/admin/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Project could not be updated."); return; }
    setItems((current) => current.map((item) => item.id === project.id ? result : item));
    setMessage(result.published ? "Project published." : "Project unpublished.");
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete “${project.title}”? This removes the case study from the project archive.`)) return;
    const response = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Project could not be deleted."); return; }
    setItems((current) => current.filter((item) => item.id !== project.id));
    setMessage("Project deleted.");
  }

  const field = (label: string, key: keyof Draft, options: { required?: boolean; type?: string; full?: boolean; rows?: number } = {}) => (
    <label className={options.full ? "field-full" : ""} key={key}>{label}
      {options.rows ? <textarea required={options.required} rows={options.rows} value={String(form[key] ?? "")} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /> :
        <input required={options.required} type={options.type || "text"} value={String(form[key] ?? "")} onChange={(event) => setForm({ ...form, [key]: options.type === "number" ? (event.target.value ? Number(event.target.value) : null) : event.target.value })} />}
    </label>
  );

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">CONTENT / PROJECT PORTFOLIO</div><h1>Project manager</h1>
    <p>Publish verified project details and permission-cleared photographs. Existing projects remain published unless you change their status.</p>
    <form className="admin-form" onSubmit={save}>
      {field("Project title", "title", { required: true })}{field("Unique URL slug", "slug", { required: true })}{field("Category", "category", { required: true })}{field("Location", "location", { required: true })}{field("Year", "year", { type: "number" })}
      {field("Cover image URL", "coverImage")}{field("Short summary", "summary", { required: true, full: true, rows: 2 })}{field("Case study description", "description", { required: true, full: true, rows: 7 })}
      <label className="field-full">Gallery image URLs (one secure URL per line)<textarea rows={4} value={galleryText} onChange={(event) => setGalleryText(event.target.value)} placeholder="Add project gallery images from the media library" /></label>
      <label><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Feature on the homepage</label>
      <label><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publish case study</label>
      <div className="field-full admin-actions"><button className="btn">{editing ? "Save changes" : "Create project"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); setGalleryText(""); }}>Cancel editing</button>}</div>
      {message && <span className="admin-notice" role="status">{message}</span>}
    </form>
    <h2>Project records ({items.length})</h2>
    {items.map((project) => <article className="admin-record" key={project.id}><div><strong>{project.title}</strong><p>{project.category} · {project.location}{project.year ? ` · ${project.year}` : ""} · {project.published ? "Published" : "Draft"}</p><small>{project.slug}</small></div><div className="admin-actions"><button onClick={() => edit(project)}>Edit</button><button onClick={() => update(project, { published: !project.published })}>{project.published ? "Unpublish" : "Publish"}</button><a href={`/projects/${project.slug}`} target="_blank" rel="noreferrer">Preview ↗</a><button onClick={() => remove(project)}>Delete</button></div></article>)}
  </main>;
}
