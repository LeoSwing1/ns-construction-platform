import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-errors";
import { canManageLeads, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { newQuotationNumber } from "@/lib/quotations";
import { databaseErrorResponse } from "@/lib/prisma-errors";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  try {
    const source = await prisma.quotation.findUnique({ where: { id }, include: { items: true } });
    if (!source) return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
    const duplicate = await prisma.quotation.create({
      data: {
        quotationNo: newQuotationNumber(),
        customerId: source.customerId,
        enquiryId: source.enquiryId,
        packageId: source.packageId,
        status: "DRAFT",
        propertyType: source.propertyType,
        siteLocation: source.siteLocation,
        plotAreaSqFt: source.plotAreaSqFt,
        constructionAreaSqFt: source.constructionAreaSqFt,
        floors: source.floors,
        requirements: source.requirements,
        baseRatePerSqFt: source.baseRatePerSqFt,
        upgradeRatePerSqFt: source.upgradeRatePerSqFt,
        applicableRatePerSqFt: source.applicableRatePerSqFt,
        subtotal: source.subtotal,
        gstRate: source.gstRate,
        gstAmount: source.gstAmount,
        additionalCharges: source.additionalCharges ?? [],
        totalAmount: source.totalAmount,
        inclusions: source.inclusions,
        exclusions: source.exclusions,
        paymentMilestones: source.paymentMilestones ?? [],
        validityDays: source.validityDays,
        validUntil: new Date(Date.now() + source.validityDays * 24 * 60 * 60 * 1000),
        items: { create: source.items.map((item) => ({
          specificationId: item.specificationId,
          categoryName: item.categoryName,
          specificationName: item.specificationName,
          quality: item.quality,
          brand: item.brand,
          details: item.details,
          adjustmentPerSqFt: item.adjustmentPerSqFt,
          includedInPackage: item.includedInPackage,
        })) },
        revisions: { create: { revision: 1, snapshot: { quotationNo: source.quotationNo, totalAmount: source.totalAmount.toString(), items: source.items.map((item) => ({ category: item.categoryName, specification: item.specificationName, adjustmentPerSqFt: item.adjustmentPerSqFt.toString() })) }, actorEmail: admin.email } },
        activities: { create: { action: "QUOTATION_DUPLICATED", details: `Copied from ${source.quotationNo}.`, actorEmail: admin.email } },
      },
    });
    return NextResponse.json({ id: duplicate.id, quotationNo: duplicate.quotationNo }, { status: 201 });
  } catch (error) {
    logApiError("/api/admin/quotations/[id]/duplicate POST", error);
    return NextResponse.json(databaseErrorResponse(error, "Quotation could not be duplicated."), { status: 503 });
  }
}
