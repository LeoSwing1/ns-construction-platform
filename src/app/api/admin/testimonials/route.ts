import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageContent, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse } from "@/lib/prisma-errors";

const schema = z.object({
  customerName: z.string().trim().min(2).max(100),
  attribution: z.string().trim().max(160).optional(),
  quote: z.string().trim().min(10).max(1500),
  verified: z.boolean().default(false),
  published: z.boolean().default(false),
});

export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  try {
    return NextResponse.json(await prisma.testimonial.findMany({ orderBy: { updatedAt: "desc" } }));
  } catch (error) {
    logApiError("/api/admin/testimonials GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Testimonials are temporarily unavailable."), { status: 503 });
  }
}

export async function POST(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageContent(admin)) return NextResponse.json({ error: "You do not have permission to manage testimonials." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the customer's published feedback and attribution." }, { status: 400 });
  if (parsed.data.published && !parsed.data.verified) return NextResponse.json({ error: "Verify that customer feedback is genuine before publishing it." }, { status: 400 });
  try {
    const item = await prisma.testimonial.create({ data: parsed.data });
    await prisma.activityLog.create({ data: { action: "TESTIMONIAL_CREATED", entityType: "TESTIMONIAL", entityId: item.id, actorEmail: admin.email, details: "Customer testimonial created." } });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    logApiError("/api/admin/testimonials POST", error);
    return NextResponse.json(databaseErrorResponse(error, "Testimonial could not be saved."), { status: 503 });
  }
}
