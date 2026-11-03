import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageSettings, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse } from "@/lib/prisma-errors";

const schema = z.object({
  phoneDisplay: z.string().trim().min(7).max(25).regex(/^[+\d\s().-]+$/),
  whatsappNumber: z.string().trim().regex(/^\d{10,15}$/),
  location: z.string().trim().min(2).max(120),
  mapsUrl: z.string().url().refine((value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      return url.protocol === "https:" && (host === "google.com" || host.endsWith(".google.com") || host === "maps.app.goo.gl");
    } catch { return false; }
  }),
  facebookUrl: z.string().url().refine((value) => { try { const host = new URL(value).hostname; return host === "facebook.com" || host.endsWith(".facebook.com"); } catch { return false; } }),
  instagramUrl: z.union([z.string().url().refine((value) => { try { const host = new URL(value).hostname; return host === "instagram.com" || host.endsWith(".instagram.com"); } catch { return false; } }), z.literal("")]),
});

export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageSettings(admin)) return NextResponse.json({ error: "Only administrators can change website settings." }, { status: 403 });
  try {
    const values = await prisma.siteSetting.findMany({ select: { key: true, value: true } });
    return NextResponse.json(Object.fromEntries(values.map(({ key, value }) => [key, value])));
  } catch (error) {
    logApiError("/api/admin/settings GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Website settings are temporarily unavailable."), { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageSettings(admin)) return NextResponse.json({ error: "Only administrators can change website settings." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the phone, WhatsApp number, location and social or map links." }, { status: 400 });
  try {
    const entries = Object.entries(parsed.data);
    await prisma.$transaction([
      ...entries.map(([key, value]) => prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } })),
      prisma.activityLog.create({ data: { action: "WEBSITE_SETTINGS_UPDATED", entityType: "SITE_SETTINGS", entityId: "public-contact", actorEmail: admin.email, details: "Public contact and social links updated." } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("/api/admin/settings PATCH", error);
    return NextResponse.json(databaseErrorResponse(error, "Website settings could not be saved."), { status: 503 });
  }
}
