"use client";

import { useState } from "react";
import { site } from "@/lib/site";

type Consultation = {
  name: string;
  phone: string;
  email: string;
  projectType: string;
  location: string;
  projectArea: string;
  floors: string;
  budget: string;
  services: string[];
  timeline: string;
  message: string;
};

const initialForm: Consultation = {
  name: "",
  phone: "",
  email: "",
  projectType: "",
  location: "",
  projectArea: "",
  floors: "",
  budget: "",
  services: [],
  timeline: "",
  message: "",
};
const projectTypes = ["New home", "Residential building", "Commercial development", "Civil or structural works", "Interior execution", "Renovation", "Other"];
const serviceOptions = ["Planning and engineering", "Architectural coordination", "Structure and RCC", "Complete construction", "Interior and finishing", "Renovation"];

export default function EnquiryForm() {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [notice, setNotice] = useState("");
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());

  function update<K extends keyof Consultation>(key: K, value: Consultation[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleService(service: string) {
    update("services", form.services.includes(service)
      ? form.services.filter((item) => item !== service)
      : [...form.services, service]);
  }

  function goNext() {
    const requiredByStep: Record<number, (keyof Consultation)[]> = {
      0: ["name", "phone", "email"],
      1: ["projectType", "location"],
      2: ["budget", "timeline"],
    };
    const required = requiredByStep[step] ?? [];
    for (const key of required) {
      const element = document.querySelector<HTMLElement>(`[name="${key}"]`);
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        if (!element.reportValidity()) return;
      }
    }
    setStep((current) => Math.min(current + 1, 3));
  }

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (selected.length > 5 || selected.some((file) => !allowed.has(file.type) || file.size > 10 * 1024 * 1024)) {
      setNotice("Attach up to five JPG, PNG, WebP or PDF files, each under 10 MB.");
      setState("error");
      event.target.value = "";
      return;
    }
    setNotice("");
    setState("idle");
    setFiles(selected);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    const payload = new FormData();
    payload.set("submissionId", submissionId);
    for (const [key, value] of Object.entries(form)) {
      if (key === "services") form.services.forEach((service) => payload.append("services", service));
      else payload.set(key, String(value));
    }
    payload.set("website", String(formData.get("website") || ""));
    for (const file of files) payload.append("files", file);

    try {
      const response = await fetch("/api/enquiries", { method: "POST", body: payload });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not submit your request.");
      setState("success");
      setNotice("Your consultation request has been received. Our team will be in touch.");
      setForm(initialForm);
      setFiles([]);
      setStep(0);
      setSubmissionId(crypto.randomUUID());
    } catch (error) {
      setState("error");
      setNotice(error instanceof Error ? error.message : "Please try again or call our team.");
    }
  }

  return (
    <section className="consultation-card" aria-labelledby="consultation-title">
      <div className="consultation-intro">
        <div className="eyebrow">PROJECT CONSULTATION / 03 MINUTES</div>
        <h3 id="consultation-title">A good build begins with a better brief.</h3>
        <p>Share a few details so our team can understand your site, scope and timing before we speak.</p>
        <div className="consultation-promise"><span>01</span> Reviewed by our team <span>02</span> No obligation to proceed</div>
      </div>
      <div className="consultation-form-wrap">
        <div className="step-track" aria-label={`Step ${step + 1} of 4`}>
          {[0, 1, 2, 3].map((item) => <span className={item <= step ? "step-dot is-active" : "step-dot"} key={item} />)}
        </div>
        <div className="step-title"><span>STEP 0{step + 1} / 04</span><strong>{["Your details", "The project", "Scope and timing", "Review and send"][step]}</strong></div>
        {state === "success" ? (
          <div className="form-success" role="status"><span>✓</span><h4>Thank you. We have your brief.</h4><p>{notice}</p><button className="text-link" type="button" onClick={() => { setState("idle"); setNotice(""); }}>Start another consultation ↗</button></div>
        ) : (
          <form onSubmit={submit}>
            {step === 0 && <div className="form-grid">
              <label>Full name *<input autoComplete="name" name="name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" /></label>
              <label>Phone number *<input autoComplete="tel" name="phone" type="tel" required minLength={8} maxLength={24} pattern="[0-9+\(\) .\-]{8,24}" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91" /></label>
              <label className="field-full">Email address<input autoComplete="email" name="email" type="email" maxLength={254} value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" /></label>
            </div>}
            {step === 1 && <div className="form-grid">
              <label>What are you planning? *<select name="projectType" required value={form.projectType} onChange={(event) => update("projectType", event.target.value)}><option value="">Choose a project type</option>{projectTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Site location *<input name="location" required maxLength={160} value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="Area, city or site address" /></label>
              <label>Approximate area<input name="projectArea" maxLength={100} value={form.projectArea} onChange={(event) => update("projectArea", event.target.value)} placeholder="For example, 2,400 sq ft" /></label>
              <label>Number of floors<input name="floors" type="number" min="1" max="100" value={form.floors} onChange={(event) => update("floors", event.target.value)} placeholder="If known" /></label>
            </div>}
            {step === 2 && <div className="form-grid">
              <label>Approximate budget<select name="budget" value={form.budget} onChange={(event) => update("budget", event.target.value)}><option value="">Prefer not to say</option><option>Under ₹10 lakh</option><option>₹10–25 lakh</option><option>₹25–50 lakh</option><option>₹50 lakh–₹1 crore</option><option>₹1 crore+</option><option>To be discussed</option></select></label>
              <label>When would you like to begin?<select name="timeline" value={form.timeline} onChange={(event) => update("timeline", event.target.value)}><option value="">Select a timeline</option><option>As soon as possible</option><option>Within 3 months</option><option>Within 6 months</option><option>More than 6 months</option><option>Still planning</option></select></label>
              <fieldset className="field-full service-picker"><legend>What would you like help with?</legend><div>{serviceOptions.map((service) => <label key={service}><input type="checkbox" checked={form.services.includes(service)} onChange={() => toggleService(service)} />{service}</label>)}</div></fieldset>
              <label className="field-full">Tell us more<textarea name="message" rows={4} maxLength={3000} value={form.message} onChange={(event) => update("message", event.target.value)} placeholder="Requirements, questions or anything else we should know" /></label>
              <label className="field-full upload-field">Plans, drawings or reference images <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={chooseFiles} /><small>Up to 5 files · PDF, JPG, PNG or WebP · 10 MB each. Secure uploads require media storage configuration.</small>{files.length > 0 && <span>{files.map((file) => file.name).join(", ")}</span>}</label>
            </div>}
            {step === 3 && <div className="review-list">
              <div><span>Contact</span><strong>{form.name} · {form.phone}{form.email ? ` · ${form.email}` : ""}</strong></div>
              <div><span>Project</span><strong>{form.projectType} · {form.location}</strong></div>
              <div><span>Scale</span><strong>{[form.projectArea, form.floors ? `${form.floors} floors` : ""].filter(Boolean).join(" · ") || "Not specified"}</strong></div>
              <div><span>Budget and start</span><strong>{form.budget || "Not specified"} · {form.timeline || "Not specified"}</strong></div>
              <div><span>Services</span><strong>{form.services.join(", ") || "To be discussed"}</strong></div>
              <div><span>Attachments</span><strong>{files.length ? files.map((file) => file.name).join(", ") : "None"}</strong></div>
              {form.message && <div><span>Requirements</span><strong>{form.message}</strong></div>}
              <p className="form-privacy">By sending this request, you agree that N.S. Construction may contact you about this project. Your details are handled according to our <a href="/privacy">privacy policy</a>.</p>
            </div>}
            <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            {notice && <p className={state === "error" ? "form-error" : "form-note"} role={state === "error" ? "alert" : "status"}>{notice}{state === "error" && <>{" "}Need help now? <a href={`tel:${site.phoneHref}`}>Call {site.phoneDisplay}</a>.</>}</p>}
            <div className="form-controls">
              {step > 0 && <button className="btn-quiet" type="button" onClick={() => setStep((current) => current - 1)}>← Back</button>}
              <span className="form-step-count">0{step + 1} / 04</span>
              {step < 3 ? <button className="btn" type="button" onClick={goNext}>Continue ↗</button> : <button className="btn" disabled={state === "sending"} type="submit">{state === "sending" ? "Sending request…" : "Send consultation request ↗"}</button>}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
