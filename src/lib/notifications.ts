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
