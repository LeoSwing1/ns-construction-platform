import { NextResponse } from "next/server";
import { canManageSettings, getAdminOrResponse } from "@/lib/auth";
import { site } from "@/lib/site";
import { prismaErrorCode } from "@/lib/prisma-errors";

type IntegrationName = "resend" | "cloudinary";

function integrationList() {
  const mediaConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const mailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.ENQUIRY_NOTIFY_EMAIL);
  return [
    { id: "whatsapp", name: "WhatsApp click-to-chat", state: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || site.phoneHref ? "Link configured" : "Needs phone number", detail: "Opens a customer chat link. This is not the WhatsApp Business API." },
    { id: "resend", name: "Resend email delivery", state: mailConfigured ? "Configured · test required" : "Awaiting credentials", detail: "Enquiry notification delivery; customer acknowledgements require a verified sender domain." },
    { id: "maps", name: "Google Maps", state: "Location link ready", detail: "Links to the Lucknow area. A verified business pin or Maps API key has not been configured." },
    { id: "analytics", name: "Google Analytics 4", state: process.env.NEXT_PUBLIC_GA_ID ? "ID configured · consent-gated" : "Awaiting measurement ID", detail: "Analytics scripts load only after visitors accept optional analytics." },
    { id: "search-console", name: "Google Search Console", state: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? "Verification configured" : "Awaiting verification token", detail: "Ownership verification only; indexing and Search Console reporting are not tested here." },
    { id: "meta-pixel", name: "Meta Pixel", state: process.env.NEXT_PUBLIC_META_PIXEL_ID ? "ID configured · consent-gated" : "Awaiting pixel ID", detail: "Pixel loads only after visitors accept optional analytics." },
    { id: "social", name: "Facebook & Instagram", state: process.env.NEXT_PUBLIC_INSTAGRAM_URL ? "Page links configured" : "Facebook link configured · Instagram awaiting URL", detail: "Links only. Follower counts, publishing and platform APIs are not connected." },
    { id: "cloudinary", name: "Cloudinary media storage", state: mediaConfigured ? "Configured · test required" : "Awaiting credentials", detail: "Secure server-side media uploads for project images and enquiry attachments." },
  ];
}

export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageSettings(admin)) return NextResponse.json({ error: "Only administrators can view integration status." }, { status: 403 });
  return NextResponse.json(integrationList());
}

export async function POST(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageSettings(admin)) return NextResponse.json({ error: "Only administrators can test integrations." }, { status: 403 });
  const body = await request.json().catch(() => null) as { integration?: IntegrationName } | null;
  if (!body || !["resend", "cloudinary"].includes(body.integration || "")) {
    return NextResponse.json({ error: "Only Resend and Cloudinary provide a live connection test." }, { status: 400 });
  }

  try {
    let response: Response;
    if (body.integration === "resend") {
      if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 400 });
      response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(10_000),
      });
    } else {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) return NextResponse.json({ error: "Cloudinary credentials are not fully configured." }, { status: 400 });
      response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/ping`, {
        headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` },
        signal: AbortSignal.timeout(10_000),
      });
    }

    if (!response.ok) {
      console.error("Integration connection test failed", { integration: body.integration, status: response.status, actor: admin.email });
      return NextResponse.json({ error: `The ${body.integration} service rejected the configured credentials (HTTP ${response.status}).` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, message: body.integration === "resend" ? "Resend accepted the credentials. No email was sent." : "Cloudinary accepted the credentials. No media was uploaded." });
  } catch (error) {
    console.error("Integration connection test could not reach provider", { integration: body.integration, actor: admin.email, code: prismaErrorCode(error) || "PROVIDER_UNAVAILABLE" });
    return NextResponse.json({ error: "The provider could not be reached. Check the server network and try again." }, { status: 502 });
  }
}
