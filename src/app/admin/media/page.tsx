"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Asset = { id: string; url: string; format: string; bytes: number; width: number | null; height: number | null; altText: string | null; createdAt: string };

export default function MediaLibrary() {
  const [items, setItems] = useState<Asset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/admin/media");
    if (response.status === 401) { location.href = "/admin/login"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load media.");
    setItems(result);
  }

  useEffect(() => {
    load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load media.")).finally(() => setLoading(false));
  }, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setMessage("Uploading securely…");
    const data = new FormData();
    data.set("file", file);
    data.set("altText", altText);
    const response = await fetch("/api/admin/media", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Image upload failed."); return; }
    setItems((current) => [result, ...current]);
    setFile(null);
    setAltText("");
    setMessage("Image uploaded. Copy its secure URL into a project cover or gallery.");
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setMessage("Secure image URL copied.");
  }

  async function remove(item: Asset) {
    if (!window.confirm("Remove this image from Cloudinary? Images used by a project or enquiry are protected.")) return;
    const response = await fetch("/api/admin/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Image could not be deleted."); return; }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setMessage("Image removed from secure storage.");
  }

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">CONTENT / MEDIA</div><h1>Project media library</h1>
    <p>Upload permission-cleared project photography. Uploaded image links can be added to project cover and gallery fields.</p>
    <form className="admin-form" onSubmit={upload}>
      <label className="field-full">Project image (JPG, PNG or WebP, max 8 MB)<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <label className="field-full">Alternative text<input required maxLength={250} value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the photograph for screen-reader users" /></label>
      <button className="btn" disabled={!file}>Upload image</button>
      {message && <span className="admin-notice" role="status">{message}</span>}
    </form>
    <h2>Stored images ({items.length})</h2>
    {loading ? <p>Loading media…</p> : items.length === 0 ? <div className="empty-state">No images have been uploaded. Connect Cloudinary credentials to enable secure media storage.</div> :
      <div className="media-grid">{items.map((item) => <article className="media-card" key={item.id}>
        <Image src={item.url} alt={item.altText || ""} width={900} height={600} unoptimized />
        <div><strong>{item.altText || "Alternative text not provided"}</strong><small>{item.width ?? "—"} × {item.height ?? "—"} · {item.format.toUpperCase()} · {(item.bytes / 1024).toFixed(0)} KB</small><button className="text-link" onClick={() => copy(item.url)}>Copy secure URL ↗</button><button className="media-delete" onClick={() => remove(item)}>Delete if unused</button></div>
      </article>)}</div>}
  </main>;
}
