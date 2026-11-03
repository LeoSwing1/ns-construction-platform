"use client";

import { useEffect, useState } from "react";

type Settings = { phoneDisplay: string; whatsappNumber: string; location: string; mapsUrl: string; facebookUrl: string; instagramUrl: string };
const defaults: Settings = { phoneDisplay: "", whatsappNumber: "", location: "", mapsUrl: "", facebookUrl: "", instagramUrl: "" };
export default function SettingsPage() {
  const [values, setValues] = useState(defaults);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings").then(async (response) => {
      if (response.status === 401) { location.href = "/admin/login"; return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load website settings.");
      setValues((current) => ({ ...current, ...result }));
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load website settings."));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const result = await response.json();
    setMessage(response.ok ? "Website contact settings saved." : result.error || "Settings could not be saved.");
  }

  function field(key: keyof Settings, label: string, type = "text") {
    return <label>{label}<input required={key !== "instagramUrl"} type={type} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} /></label>;
  }

  function useLocationSearch() {
    const query = encodeURIComponent(values.location.trim());
    if (!query) {
      setMessage("Enter the business location before generating a Google Maps link.");
      return;
    }
    setValues((current) => ({ ...current, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${query}` }));
    setMessage("Google Maps search link generated from the business location. Save settings to publish it.");
  }

  return <main className="admin-page">
    <a className="plain-link" href="/admin">← Control room</a><div className="section-index">WEBSITE / BUSINESS DETAILS</div><h1>Website settings</h1>
    <p>These public contact and social details are stored in the database, validated, and used by the public website. Keep API secrets in environment variables only.</p>
    <form className="admin-form" onSubmit={save}>
      {field("phoneDisplay", "Business phone number", "tel")}{field("whatsappNumber", "WhatsApp number (international digits)")}{field("location", "Business location")}
      {field("mapsUrl", "Google Maps location URL", "url")}<button className="text-link" type="button" onClick={useLocationSearch}>Generate a Maps search link from the business location ↗</button>
      {field("facebookUrl", "Facebook page URL", "url")}{field("instagramUrl", "Instagram page URL (optional)", "url")}
      <button className="btn">Save settings</button>{message && <span className="admin-notice" role="status">{message}</span>}
    </form>
  </main>;
}
