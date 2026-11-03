import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageLeads, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse } from "@/lib/prisma-errors";
import { calculateEstimate, decimal, estimateInputSchema, QuotationInputError, QuotationNotFoundError } from "@/lib/quotations";

const revisionSchema = estimateInputSchema.extend({
  propertyType: z.string().trim().min(2).max(100),
  siteLocation: z.string().trim().min(2).max(240),
  plotAreaSqFt: z.number().finite().positive().max(1_000_000).nullable(),
  floors: z.number().int().min(1).max(100).nullable(),
  requirements: z.string().trim().max(5000),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const parsed = revisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid revision details." }, { status: 400 });
  try {
    const estimate = await calculateEstimate(parsed.data);
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.quotation.findUnique({ where: { id }, include: { items: true, customer: true, package: true } });
      if (!current) throw new QuotationNotFoundError("Quotation not found.");
      const previousSnapshot = JSON.parse(JSON.stringify(current));
      const revision = await transaction.quotationRevision.aggregate({ where: { quotationId: id }, _max: { revision: true } });
      const nextRevision = (revision._max.revision ?? 0) + 1;
      const quote = await transaction.quotation.update({
        where: { id },
        data: {
          packageId: estimate.packageId,
          propertyType: parsed.data.propertyType,
          siteLocation: parsed.data.siteLocation,
          plotAreaSqFt: parsed.data.plotAreaSqFt === null ? null : decimal(parsed.data.plotAreaSqFt),
          constructionAreaSqFt: decimal(parsed.data.constructionAreaSqFt),
          floors: parsed.data.floors,
          requirements: parsed.data.requirements,
          baseRatePerSqFt: decimal(estimate.baseRatePerSqFt),
          upgradeRatePerSqFt: decimal(estimate.upgradeRatePerSqFt),
          applicableRatePerSqFt: decimal(estimate.applicableRatePerSqFt),
          subtotal: decimal(estimate.subtotal),
          gstRate: estimate.gstRate === null ? null : decimal(estimate.gstRate),
          gstAmount: decimal(estimate.gstAmount),
          additionalCharges: estimate.additionalCharges,
          totalAmount: decimal(estimate.totalAmount),
          inclusions: estimate.inclusions,
          exclusions: estimate.exclusions,
          paymentMilestones: estimate.paymentMilestones,
          validityDays: estimate.validityDays,
          issuedAt: new Date(),
          validUntil: new Date(Date.now() + estimate.validityDays * 24 * 60 * 60 * 1000),
          status: "REVISION_REQUESTED",
          items: {
            deleteMany: {},
            create: estimate.items.map((item) => ({
              specificationId: item.specificationId,
              categoryName: item.categoryName,
              specificationName: item.specificationName,
              quality: item.quality,
              brand: item.brand,
              details: item.details,
              adjustmentPerSqFt: decimal(item.adjustmentPerSqFt),
              includedInPackage: item.includedInPackage,
            })),
          },
        },
      });
      await transaction.quotationRevision.create({
        data: { quotationId: id, revision: nextRevision, snapshot: previousSnapshot, actorEmail: admin.email },
      });
      await transaction.quotationActivity.create({
        data: { quotationId: id, action: "REVISION_CREATED", details: `Revision ${nextRevision} saved; prior quotation retained in revision history.`, actorEmail: admin.email },
      });
      return quote;
    });
    return NextResponse.json({ id: result.id, status: result.status, totalAmount: result.totalAmount.toString() });
  } catch (error) {
    if (error instanceof QuotationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof QuotationInputError) return NextResponse.json({ error: error.message }, { status: 422 });
    logApiError("/api/admin/quotations/[id]/revisions POST", error);
    return NextResponse.json(databaseErrorResponse(error, "Quotation revision could not be saved."), { status: 503 });
  }
}
