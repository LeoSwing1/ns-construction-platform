import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageLeads, canManageSettings, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createQuotationRecord } from "@/lib/quotation-record";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";
import { calculateEstimate, QuotationInputError, QuotationNotFoundError, quotationSubmissionSchema } from "@/lib/quotations";

const quotationStatuses = ["DRAFT", "SENT", "VIEWED", "UNDER_DISCUSSION", "REVISION_REQUESTED", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export async function GET(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const search = query.get("q")?.trim().slice(0, 100);
  const status = query.get("status");
  if (status && !quotationStatuses.includes(status as typeof quotationStatuses[number])) {
    return NextResponse.json({ error: "Invalid quotation status filter." }, { status: 400 });
  }
  try {
    const [quotations, packages, counts, followUpsDue] = await Promise.all([
      prisma.quotation.findMany({
        where: {
          ...(status ? { status: status as typeof quotationStatuses[number] } : {}),
          ...(search ? {
            OR: [
              { quotationNo: { contains: search, mode: "insensitive" } },
              { customer: { name: { contains: search, mode: "insensitive" } } },
              { customer: { phone: { contains: search } } },
              { siteLocation: { contains: search, mode: "insensitive" } },
            ],
          } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: {
          customer: { select: { name: true, phone: true, email: true } },
          package: { select: { name: true, quality: true } },
          enquiry: { select: { followUpAt: true } },
          items: { orderBy: { createdAt: "asc" } },
          activities: { orderBy: { createdAt: "desc" }, take: 10 },
          _count: { select: { revisions: true } },
        },
      }),
      prisma.constructionPackage.findMany({ where: { active: true }, orderBy: { quality: "asc" }, select: { id: true, name: true, quality: true, ratePerSqFt: true } }),
      prisma.quotation.groupBy({ by: ["status"], _count: { _all: true }, _sum: { totalAmount: true } }),
      prisma.quotation.count({ where: { status: { notIn: ["ACCEPTED", "REJECTED", "EXPIRED"] }, enquiry: { followUpAt: { lte: new Date() } } } }),
    ]);
    const total = counts.reduce((sum, item) => sum + item._count._all, 0);
    const accepted = counts.find((item) => item.status === "ACCEPTED")?._count._all ?? 0;
    return NextResponse.json({
      quotations,
      packages: packages.map((item) => ({ ...item, ratePerSqFt: item.ratePerSqFt?.toString() ?? null })),
      analytics: {
        total,
        drafts: counts.find((item) => item.status === "DRAFT")?._count._all ?? 0,
        sent: counts.find((item) => item.status === "SENT")?._count._all ?? 0,
        accepted,
        rejected: counts.find((item) => item.status === "REJECTED")?._count._all ?? 0,
        totalEstimatedValue: counts.reduce((sum, item) => sum + Number(item._sum.totalAmount?.toString() ?? 0), 0),
        followUpsDue,
        conversionRate: total === 0 ? 0 : Math.round(accepted / total * 10000) / 100,
      },
      canManagePricing: canManageSettings(admin),
    });
  } catch (error) {
    logApiError("/api/admin/quotations GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Quotations are temporarily unavailable."), { status: 503 });
  }
}

const createSchema = quotationSubmissionSchema.omit({ submissionId: true }).extend({
  enquiryId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the customer and project details before creating the quotation." }, { status: 400 });
  const { enquiryId, ...submitted } = parsed.data;
  const data = { ...submitted, submissionId: randomUUID() };
  try {
    const estimate = await calculateEstimate(data);
    if (estimate.items.some((item) => !item.includedInPackage) && !data.confirmUpgrades) {
      return NextResponse.json({ error: "Confirm the itemised material upgrades before creating this quotation." }, { status: 409 });
    }
    const { quotation, quotationUrl } = await createQuotationRecord(data, estimate, admin.email, enquiryId);
    return NextResponse.json({ id: quotation.id, quotationNo: quotation.quotationNo, totalAmount: quotation.totalAmount.toString(), quotationUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof QuotationInputError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof QuotationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    logApiError("/api/admin/quotations POST", error);
    return NextResponse.json(databaseErrorResponse(error, "Quotation could not be created."), { status: 503 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(quotationStatuses),
});

export async function PATCH(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid quotation status update." }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const item = await transaction.quotation.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
      await transaction.quotationActivity.create({
        data: { quotationId: item.id, action: "STATUS_CHANGED", details: `Quotation status changed to ${parsed.data.status}.`, actorEmail: admin.email },
      });
      if (item.enquiryId && ["SENT", "VIEWED", "UNDER_DISCUSSION", "REVISION_REQUESTED", "ACCEPTED", "REJECTED"].includes(parsed.data.status)) {
        await transaction.activityLog.create({
          data: { action: "QUOTATION_STATUS_CHANGED", entityType: "ENQUIRY", entityId: item.enquiryId, enquiryId: item.enquiryId, actorEmail: admin.email, details: `Quotation ${item.quotationNo} status changed to ${parsed.data.status}.` },
        });
      }
      return item;
    });
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    logApiError("/api/admin/quotations PATCH", error);
    return prismaErrorCode(error) === "P2025"
      ? NextResponse.json({ error: "Quotation not found.", code: "RECORD_NOT_FOUND" }, { status: 404 })
      : NextResponse.json(databaseErrorResponse(error, "Quotation status could not be updated."), { status: 503 });
  }
}
