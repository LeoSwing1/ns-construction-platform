"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string; email: string; role: "ADMIN" | "EDITOR" | "SALES"; disabled: boolean; createdAt: string };
export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SALES" as User["role"] });
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/users");
    if (response.status === 401) { location.href = "/admin/login"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load team accounts.");
    setUsers(result);
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load team accounts.")); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Team account could not be created."); return; }
    setUsers((current) => [...current, result]);
    setForm({ name: "", email: "", password: "", role: "SALES" });
    setMessage("Team account created. Share the temporary password securely.");
  }

  async function update(user: User, changes: { role?: User["role"]; disabled?: boolean }) {
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, ...changes }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Team account could not be updated."); return; }
    setUsers((current) => current.map((item) => item.id === user.id ? result : item));
    setMessage("Role and access changes are active immediately.");
  }

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">OPERATIONS / ACCESS CONTROL</div><h1>Team & roles</h1>
    <p>Team passwords are stored as scrypt hashes. Role changes and account deactivation are recorded and apply to existing sessions immediately.</p>
    <form className="admin-form" onSubmit={create}>
      <label>Name<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Temporary password (12+ characters)<input required minLength={12} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as User["role"] })}><option value="SALES">Sales / lead management</option><option value="EDITOR">Editor / content management</option><option value="ADMIN">Administrator</option></select></label>
      <button className="btn">Create account</button>{message && <span className="admin-notice" role="status">{message}</span>}
    </form>
    <h2>Accounts ({users.length})</h2>
    {users.map((user) => <article className="admin-record" key={user.id}>
      <div><strong>{user.name}</strong><p>{user.email} · {user.role} · {user.disabled ? "Access disabled" : "Active"}</p></div>
      <div className="admin-actions"><select aria-label={`Role for ${user.name}`} value={user.role} onChange={(event) => update(user, { role: event.target.value as User["role"] })}><option value="SALES">Sales</option><option value="EDITOR">Editor</option><option value="ADMIN">Administrator</option></select><button onClick={() => update(user, { disabled: !user.disabled })}>{user.disabled ? "Enable access" : "Disable access"}</button></div>
    </article>)}
  </main>;
}
