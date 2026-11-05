export type DeliveryAttempt = {
  recipient: string;
  status: "SENT" | "FAILED" | "NOT_CONFIGURED";
  providerMessageId?: string;
  error?: string;
};

async function sendEmail(recipient: string, subject: string, text: string): Promise<DeliveryAttempt> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { recipient, status: "NOT_CONFIGURED" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [recipient], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Email provider rejected a delivery", { status: response.status, recipient });
      return { recipient, status: "FAILED", error: `Provider returned HTTP ${response.status}.` };
    }
    const result = await response.json() as { id?: string };
    return { recipient, status: "SENT", providerMessageId: result.id };
  } catch (error) {
    console.error("Email delivery could not reach provider", { recipient, error });
    return { recipient, status: "FAILED", error: "Provider could not be reached." };
  }
}

export async function sendEnquiryNotifications(enquiry: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  projectType: string;
  location: string | null;
  projectArea: string | null;
  floors: number | null;
  budget: string | null;
  services: string[];
  timeline: string | null;
  message: string | null;
}, skipRecipients: ReadonlySet<string> = new Set()) {
  const businessEmail = process.env.ENQUIRY_NOTIFY_EMAIL;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { status: "NOT_CONFIGURED", attempts: [] as DeliveryAttempt[] };
  }
  const details = [
    `Name: ${enquiry.name}`,
    `Phone: ${enquiry.phone}`,
    `Email: ${enquiry.email || "Not supplied"}`,
    `Project: ${enquiry.projectType}`,
    `Location: ${enquiry.location || "Not supplied"}`,
    `Area: ${enquiry.projectArea || "Not supplied"}`,
    `Floors: ${enquiry.floors || "Not supplied"}`,
    `Budget: ${enquiry.budget || "Not supplied"}`,
    `Timeline: ${enquiry.timeline || "Not supplied"}`,
    `Services: ${enquiry.services.join(", ") || "Not specified"}`,
    `Requirements: ${enquiry.message || "Not supplied"}`,
    `Enquiry ID: ${enquiry.id}`,
  ].join("\n");

  const targets = [
    ...(businessEmail ? [{ recipient: businessEmail, subject: `New project enquiry: ${enquiry.name}`, text: details }] : []),
    ...(enquiry.email ? [{ recipient: enquiry.email, subject: "We received your project enquiry", text: `Hello ${enquiry.name},\n\nThank you for contacting N.S. Construction. We have received your project consultation request and will review the details before getting back to you.\n\nThis acknowledgement is not a quotation or confirmation of project availability.\n\nN.S. Construction\n${enquiry.phone}` }] : []),
  ].filter((target) => !skipRecipients.has(target.recipient));
  if (targets.length === 0) return { status: skipRecipients.size ? "SENT" : "NOT_CONFIGURED", attempts: [] as DeliveryAttempt[] };
  const attempts = await Promise.all(targets.map((target) => sendEmail(target.recipient, target.subject, target.text)));
  const sent = attempts.filter((attempt) => attempt.status === "SENT").length;
  const failures = attempts.filter((attempt) => attempt.status === "FAILED").length;
  const status = failures && sent ? "PARTIAL" : failures ? "FAILED" : "SENT";
  return { status, attempts };
}

export type IntegrationDelivery = {
  status: "SENT" | "FAILED" | "NOT_CONFIGURED";
  providerMessageId?: string;
  error?: string;
};

function cleanWhatsAppPhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function sendWhatsAppEnquiryAlert(enquiry: {
  id: string; name: string; phone: string; projectType: string; location: string | null;
}): Promise<IntegrationDelivery> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient = process.env.WHATSAPP_NOTIFY_PHONE;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!phoneNumberId || !token || !recipient || !templateName) return { status: "NOT_CONFIGURED" };

  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  if (!/^v\d+\.\d+$/.test(version)) return { status: "FAILED", error: "WhatsApp API version is invalid." };
  const to = cleanWhatsAppPhone(recipient);
  if (to.length < 8 || to.length > 15) return { status: "FAILED", error: "WhatsApp notification number must be in international format." };

  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US" },
          components: [{
            type: "body",
            parameters: [enquiry.name, enquiry.phone, enquiry.projectType, enquiry.location || "Not supplied", enquiry.id]
              .map((text) => ({ type: "text", text: String(text).slice(0, 240) })),
          }],
        },
      }),
      signal: AbortSignal.timeout(7_000),
    });
    const result = await response.json().catch(() => ({})) as { messages?: { id?: string }[] };
    if (!response.ok) {
      console.error("WhatsApp enquiry notification failed", { status: response.status });
      return { status: "FAILED", error: `WhatsApp provider returned HTTP ${response.status}.` };
    }
    return { status: "SENT", providerMessageId: result.messages?.[0]?.id };
  } catch {
    return { status: "FAILED", error: "WhatsApp provider could not be reached." };
  }
}

export async function sendGoogleSheetsEnquiry(enquiry: {
  id: string; name: string; phone: string; email: string | null; projectType: string;
  location: string | null; projectArea: string | null; floors: number | null; budget: string | null;
  services: string[]; timeline: string | null; message: string | null; source?: string;
}): Promise<IntegrationDelivery> {
  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  if (!webhook || !secret) return { status: "NOT_CONFIGURED" };
  let endpoint: URL;
  try { endpoint = new URL(webhook); } catch { return { status: "FAILED", error: "Google Sheets webhook URL is invalid." }; }
  if (endpoint.protocol !== "https:" || !["script.google.com", "script.googleusercontent.com"].includes(endpoint.hostname)) {
    return { status: "FAILED", error: "Google Sheets webhook must be an HTTPS Google Apps Script URL." };
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "enquiry.created", secret,
        enquiry: {
          id: enquiry.id, name: enquiry.name, phone: enquiry.phone, email: enquiry.email,
          projectType: enquiry.projectType, location: enquiry.location, projectArea: enquiry.projectArea,
          floors: enquiry.floors, budget: enquiry.budget, services: enquiry.services,
          timeline: enquiry.timeline, message: enquiry.message, source: enquiry.source || "Website",
          createdAt: new Date().toISOString(),
        },
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return { status: "FAILED", error: `Google Sheets endpoint returned HTTP ${response.status}.` };
    if (response.url && !["script.google.com", "script.googleusercontent.com"].includes(new URL(response.url).hostname)) return { status: "FAILED", error: "Google Sheets webhook redirected to an unexpected host." };
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!result || result.ok !== true) return { status: "FAILED", error: result?.error || "Google Sheets endpoint did not return a valid acknowledgement." };
    return { status: "SENT" };
  } catch {
    return { status: "FAILED", error: "Google Sheets endpoint could not be reached." };
  }
}
