"use client";

import { useState } from "react";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;
      if (!response.ok) {
        throw new Error(result?.error || "Sign-in is temporarily unavailable. The server returned an invalid response.");
      }
      if (!result?.ok) throw new Error("The sign-in response was incomplete. Please try again.");
      location.href = "/admin";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="admin-shell"><form className="login-panel" onSubmit={submit}>
    <Link className="plain-link" href="/">← Public website</Link><div className="section-index">N.S. CONSTRUCTION / ADMIN</div>
    <h1>Welcome back.</h1><p>Sign in to the website control room.</p>
    <label>Email address<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="btn" disabled={busy}>{busy ? "Verifying access…" : "Sign in securely ↗"}</button>
  </form></main>;
}
