import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageSettings, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { packageChargesSchema, paymentMilestonesSchema } from "@/lib/quotations";
import { databaseErrorResponse } from "@/lib/prisma-errors";

const updateSchema = z.object({
  id: z.string().min(1),
  ratePerSqFt: z.number().finite().positive().max(1_000_000).nullable(),
  gstRate: z.number().finite().min(0).max(100).nullable(),
  validityDays: z.number().int().min(1).max(365),
  inclusions: z.string().max(10_000),
  exclusions: z.string().max(10_000),
  additionalCharges: z.unknown(),
  paymentMilestones: z.unknown(),
});

export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  try {
    const packages = await prisma.constructionPackage.findMany({
      orderBy: { quality: "asc" },
      include: { packageMaterials: { select: { categoryId: true, specificationId: true } } },
    });
    return NextResponse.json(packages.map((item) => ({ ...item, ratePerSqFt: item.ratePerSqFt?.toString() ?? null, gstRate: item.gstRate?.toString() ?? null })));
  } catch (error) {
    logApiError("/api/admin/quotations/packages", error);
    return NextResponse.json(databaseErrorResponse(error, "Quotation packages are temporarily unavailable."), { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageSettings(admin)) return NextResponse.json({ error: "Only administrators can change package pricing." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid package pricing or terms." }, { status: 400 });
  const charges = packageChargesSchema(parsed.data.additionalCharges);
  const milestones = paymentMilestonesSchema(parsed.data.paymentMilestones);
  if (!charges.success || !milestones.success) return NextResponse.json({ error: "Check additional charges and payment milestone percentages." }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const item = await transaction.constructionPackage.update({
        where: { id: parsed.data.id },
        data: {
          ratePerSqFt: parsed.data.ratePerSqFt,
          gstRate: parsed.data.gstRate,
          validityDays: parsed.data.validityDays,
          inclusions: parsed.data.inclusions,
          exclusions: parsed.data.exclusions,
          additionalCharges: charges.data,
          paymentMilestones: milestones.data,
        },
      });
      await transaction.activityLog.create({
        data: { action: "QUOTATION_PACKAGE_UPDATED", entityType: "CONSTRUCTION_PACKAGE", entityId: item.id, actorEmail: admin.email, details: `${item.name} pricing and commercial terms updated.` },
      });
      return item;
    });
    return NextResponse.json({ ...updated, ratePerSqFt: updated.ratePerSqFt?.toString() ?? null, gstRate: updated.gstRate?.toString() ?? null });
  } catch (error) {
    logApiError("/api/admin/quotations/packages PATCH", error);
    return NextResponse.json(databaseErrorResponse(error, "Package pricing could not be saved."), { status: 503 });
  }
}
