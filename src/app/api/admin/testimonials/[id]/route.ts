import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageContent, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse } from "@/lib/prisma-errors";

const schema = z.object({
  customerName: z.string().trim().min(2).max(100).optional(),
  attribution: z.string().trim().max(160).nullable().optional(),
  quote: z.string().trim().min(10).max(1500).optional(),
  verified: z.boolean().optional(),
  published: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageContent(admin)) return NextResponse.json({ error: "You do not have permission to manage testimonials." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid testimonial update." }, { status: 400 });
  try {
    const previous = await prisma.testimonial.findUnique({ where: { id }, select: { verified: true, published: true } });
    if (!previous) return NextResponse.json({ error: "Testimonial not found." }, { status: 404 });
    const verified = parsed.data.verified ?? previous.verified;
    const published = parsed.data.published ?? previous.published;
    if (published && !verified) return NextResponse.json({ error: "Verify that customer feedback is genuine before publishing it." }, { status: 400 });
    const updated = await prisma.testimonial.update({ where: { id }, data: parsed.data });
    await prisma.activityLog.create({ data: { action: "TESTIMONIAL_UPDATED", entityType: "TESTIMONIAL", entityId: id, actorEmail: admin.email, details: "Testimonial details or publication state updated." } });
    return NextResponse.json(updated);
  } catch (error) {
    logApiError("/api/admin/testimonials/[id] PATCH", error);
    return NextResponse.json(databaseErrorResponse(error, "Testimonial could not be updated."), { status: 503 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageContent(admin)) return NextResponse.json({ error: "You do not have permission to manage testimonials." }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.$transaction([
      prisma.activityLog.create({ data: { action: "TESTIMONIAL_DELETED", entityType: "TESTIMONIAL", entityId: id, actorEmail: admin.email, details: "Testimonial deleted." } }),
      prisma.testimonial.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("/api/admin/testimonials/[id] DELETE", error);
    return NextResponse.json(databaseErrorResponse(error, "Testimonial could not be deleted."), { status: 503 });
  }
}
