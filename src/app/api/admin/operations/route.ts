import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { canManageSettings, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logApiError } from "@/lib/api-errors";
import { databaseErrorResponse } from "@/lib/prisma-errors";

const money = z.number().finite().min(0).max(1_000_000_000);
const positive = z.number().finite().positive().max(1_000_000_000);
const dateValue = z.string().datetime().optional().nullable();
const approvalThresholdEnv = process.env.PURCHASE_ORDER_SUPER_ADMIN_THRESHOLD;
const configuredApprovalThreshold = approvalThresholdEnv?.trim() ? Number(approvalThresholdEnv) : 100000;
const purchaseOrderSuperAdminThreshold = Number.isFinite(configuredApprovalThreshold) && configuredApprovalThreshold >= 0 ? configuredApprovalThreshold : 100000;

class OperationConflictError extends Error {}

function ref(prefix: string) {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `${prefix}-${date}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

async function audit(action: string, entityType: string, entityId: string, actorEmail: string, details: string) {
  try {
    await prisma.activityLog.create({ data: { action, entityType, entityId, actorEmail, details } });
  } catch (error) {
    // An audit-log outage must not turn a successfully persisted financial operation into a retryable failure.
    logApiError("Construction operations audit", error);
  }
}

export async function GET() {
  const auth = await getAdminOrResponse();
  if (auth.response) return auth.response;
  const admin = auth.admin;
  if (!canManageSettings(admin)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [jobs, suppliers, customers, quotations, supplierQuotes, materialRates, contractors, summary] = await Promise.all([
      prisma.constructionJob.findMany({
        orderBy: { updatedAt: "desc" },
        take: 500,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          quotation: { select: { id: true, quotationNo: true, totalAmount: true } },
          boqItems: true,
          costs: { orderBy: { incurredAt: "desc" } },
          purchaseOrders: { include: { supplier: { select: { id: true, companyName: true } }, items: true, deliveries: { include: { items: { include: { purchaseOrderItem: { select: { description: true, unit: true } } } } }, orderBy: { deliveredAt: "desc" } } }, orderBy: { createdAt: "desc" } },
          payments: { orderBy: { paidAt: "desc" }, include: { schedule: { select: { title: true } } } },
          paymentSchedules: { orderBy: { dueDate: "asc" }, include: { payments: { where: { status: "CLEARED" }, select: { amount: true } } } },
          labourAttendance: { orderBy: { attendanceDate: "desc" }, take: 100, include: { contractor: { select: { contractorName: true, trade: true } } } },
          contractorPayments: { orderBy: { createdAt: "desc" }, take: 100, include: { contractor: { select: { contractorName: true } } } },
          progressUpdates: { orderBy: { updateDate: "desc" }, take: 30 },
        },
      }),
      prisma.supplier.findMany({ where: { active: true }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true, phone: true } }),
      prisma.customer.findMany({ orderBy: { name: "asc" }, take: 300, select: { id: true, name: true, phone: true } }),
      prisma.quotation.findMany({ where: { status: { in: ["SENT", "VIEWED", "UNDER_DISCUSSION", "ACCEPTED"] } }, orderBy: { createdAt: "desc" }, take: 150, select: { id: true, quotationNo: true, totalAmount: true, customer: { select: { name: true } } } }),
      prisma.supplierQuote.findMany({ include: { supplier: { select: { id: true, companyName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.materialRate.findMany({ where: { status: "APPROVED", effectiveFrom: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: [{ category: "asc" }, { materialName: "asc" }], take: 300, select: { id: true, materialName: true, category: true, brand: true, specification: true, unit: true, rate: true, location: true } }),
      prisma.labourContractor.findMany({ where: { active: true }, orderBy: { contractorName: "asc" }, select: { id: true, contractorName: true, trade: true, phone: true, dailyRate: true } }),
      prisma.constructionJob.groupBy({ by: ["status"], _count: { _all: true }, _sum: { budgetAmount: true, contractAmount: true } }),
    ]);
    const enriched = jobs.map((job) => {
      const directCosts = job.costs.reduce((sum, item) => sum + Number(item.totalAmount), 0);
      const receivedProcurementValue = (po: typeof job.purchaseOrders[number]) => {
        const receivedSubtotal = po.items.reduce((sum, item) => sum + Number(item.receivedQty) * Number(item.unitRate), 0);
        const taxRatio = Number(po.subtotal) > 0 ? Number(po.taxAmount) / Number(po.subtotal) : 0;
        return receivedSubtotal * (1 + taxRatio);
      };
      const procurementReceived = job.purchaseOrders.reduce((sum, po) => sum + receivedProcurementValue(po), 0);
      const procurementCommitted = job.purchaseOrders.filter((po) => ["SENT", "PARTIALLY_RECEIVED"].includes(po.status))
        .reduce((sum, po) => sum + Math.max(0, Number(po.totalAmount) - receivedProcurementValue(po)), 0);
      const approvedLabourAccrual = job.labourAttendance.filter((entry) => entry.status === "APPROVED").reduce((sum, entry) => sum + Number(entry.totalAmount), 0);
      const actualCost = directCosts + procurementReceived + approvedLabourAccrual;
      const receivedPayments = job.payments.filter((payment) => payment.status === "CLEARED")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const pendingPayments = job.payments.filter((payment) => payment.status === "PENDING")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const boqValue = job.boqItems.reduce((sum, item) => sum + Number(item.estimatedTotal), 0);
      return {
        ...job,
        paymentSchedules: job.paymentSchedules.map((schedule) => {
          const cleared = schedule.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
          const balance = Math.max(0, Number(schedule.amount) - cleared);
          const overdue = balance > 0 && schedule.dueDate < new Date();
          return { ...schedule, clearedAmount: cleared, balance, displayStatus: balance <= 0 ? "PAID" : cleared > 0 ? "PARTIALLY_PAID" : overdue ? "OVERDUE" : schedule.status };
        }),
        actualCost,
        directCosts,
        procurementReceived,
        approvedLabourAccrual,
        procurementCommitted,
        receivedPayments,
        pendingPayments,
        outstanding: Math.max(0, Number(job.contractAmount) - receivedPayments),
        boqValue,
        costVariance: Number(job.budgetAmount) - actualCost,
        profitability: Number(job.contractAmount) - actualCost,
        projectedProfitability: Number(job.contractAmount) - actualCost - procurementCommitted,
      };
    });
    return NextResponse.json({
      jobs: enriched,
      adminRole: admin.role,
      adminEmail: admin.email,
      purchaseOrderSuperAdminThreshold,
      suppliers,
      customers,
      quotations,
      supplierQuotes,
      materialRates,
      contractors,
      summary: {
        jobs: summary.reduce((sum, item) => sum + item._count._all, 0),
        activeJobs: summary.filter((item) => ["APPROVED", "IN_PROGRESS"].includes(item.status)).reduce((sum, item) => sum + item._count._all, 0),
        contractValue: summary.reduce((sum, item) => sum + Number(item._sum.contractAmount ?? 0), 0),
        budget: summary.reduce((sum, item) => sum + Number(item._sum.budgetAmount ?? 0), 0),
        actualCost: enriched.reduce((sum, job) => sum + job.actualCost, 0),
        procurementCommitted: enriched.reduce((sum, job) => sum + job.procurementCommitted, 0),
        approvedLabourAccrual: enriched.reduce((sum, job) => sum + job.approvedLabourAccrual, 0),
        receivedPayments: enriched.reduce((sum, job) => sum + job.receivedPayments, 0),
        outstanding: enriched.reduce((sum, job) => sum + job.outstanding, 0),
        byStatus: summary.map((item) => ({ status: item.status, count: item._count._all })),
      },
    });
  } catch (error) {
    logApiError("/api/admin/operations GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Construction operations could not be loaded."), { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await getAdminOrResponse();
  if (auth.response) return auth.response;
  const admin = auth.admin;
  if (!canManageSettings(admin)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "A valid operations action is required." }, { status: 400 });

  try {
    if (body.action === "create-job") {
      const parsed = z.object({
        name: z.string().trim().min(2).max(160),
        siteLocation: z.string().trim().min(2).max(240),
        description: z.string().max(5000).optional().default(""),
        customerId: z.string().optional().nullable(),
        quotationId: z.string().optional().nullable(),
        startDate: dateValue,
        targetEndDate: dateValue,
        budgetAmount: money.default(0),
        contractAmount: money.default(0),
        projectAreaSqFt: money.default(0),
        notes: z.string().max(5000).optional().default(""),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check the project details and amounts." }, { status: 400 });
      const input = parsed.data;
      const quotation = input.quotationId ? await prisma.quotation.findUnique({ where: { id: input.quotationId }, select: { id: true, customerId: true, totalAmount: true } }) : null;
      if (input.quotationId && !quotation) return NextResponse.json({ error: "Selected quotation was not found." }, { status: 404 });
      const job = await prisma.constructionJob.create({
        data: {
          jobNo: ref("NSJ"), name: input.name, siteLocation: input.siteLocation, description: input.description,
          customerId: quotation?.customerId ?? input.customerId ?? null, quotationId: quotation?.id ?? null,
          startDate: input.startDate ? new Date(input.startDate) : null,
          targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null,
          budgetAmount: input.budgetAmount,
          contractAmount: input.contractAmount || Number(quotation?.totalAmount ?? 0),
          projectAreaSqFt: input.projectAreaSqFt,
          notes: input.notes,
        },
      });
      await audit("CONSTRUCTION_JOB_CREATED", "CONSTRUCTION_JOB", job.id, admin.email, `Created job ${job.jobNo}.`);
      return NextResponse.json({ id: job.id, jobNo: job.jobNo }, { status: 201 });
    }

    if (body.action === "update-job-financials") {
      const parsed = z.object({
        jobId: z.string().min(1),
        budgetAmount: money,
        contractAmount: money,
        projectAreaSqFt: money.default(0),
        notes: z.string().max(5000).optional(),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Enter valid approved budget and contract values." }, { status: 400 });
      const updated = await prisma.constructionJob.update({
        where: { id: parsed.data.jobId },
        data: { budgetAmount: parsed.data.budgetAmount, contractAmount: parsed.data.contractAmount, projectAreaSqFt: parsed.data.projectAreaSqFt, ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}) },
      });
      await audit("JOB_FINANCIALS_UPDATED", "CONSTRUCTION_JOB", updated.id, admin.email, `Budget set to ₹${parsed.data.budgetAmount.toLocaleString("en-IN")}; contract set to ₹${parsed.data.contractAmount.toLocaleString("en-IN")}.`);
      return NextResponse.json({ id: updated.id });
    }

    if (body.action === "add-boq") {
      const parsed = z.object({
        jobId: z.string().min(1), code: z.string().max(60).optional(),
        materialRateId: z.string().optional().nullable(),
        description: z.string().trim().min(2).max(500), category: z.string().trim().min(2).max(100),
        unit: z.string().trim().min(1).max(30), quantity: positive, unitRate: money,
        calculationBasis: z.enum(["MANUAL", "PROJECT_AREA"]).default("MANUAL"), areaFactor: z.number().finite().min(0).max(100000).default(0),
        notes: z.string().max(2000).optional().default(""),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check BOQ item details, quantity and rate." }, { status: 400 });
      const d = parsed.data;
      if (d.calculationBasis === "PROJECT_AREA" && d.areaFactor <= 0) return NextResponse.json({ error: "Area-based BOQ lines require a positive material factor." }, { status: 400 });
      const sourceRate = d.materialRateId ? await prisma.materialRate.findFirst({
        where: { id: d.materialRateId, status: "APPROVED", effectiveFrom: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { rate: true },
      }) : null;
      if (d.materialRateId && !sourceRate) return NextResponse.json({ error: "The selected material rate is no longer approved or valid. Refresh the page and select a current rate." }, { status: 409 });
      const appliedRate = sourceRate ? Number(sourceRate.rate) : d.unitRate;
      const job = await prisma.constructionJob.findUnique({ where: { id: d.jobId }, select: { projectAreaSqFt: true } });
      if (!job) return NextResponse.json({ error: "Construction job not found." }, { status: 404 });
      if (d.calculationBasis === "PROJECT_AREA" && Number(job.projectAreaSqFt) <= 0) return NextResponse.json({ error: "Set the project's built-up area before using area-based BOQ calculation." }, { status: 409 });
      const quantity = d.calculationBasis === "PROJECT_AREA" ? Number((Number(job.projectAreaSqFt) * d.areaFactor).toFixed(3)) : d.quantity;
      const total = Number((quantity * appliedRate).toFixed(2));
      const item = await prisma.boqItem.create({ data: { ...d, quantity, materialRateId: d.materialRateId || null, unitRate: appliedRate, estimatedTotal: total } });
      await audit("BOQ_ITEM_ADDED", "CONSTRUCTION_JOB", d.jobId, admin.email, `Added ${d.description}; estimated value ₹${total.toLocaleString("en-IN")}.`);
      return NextResponse.json({ id: item.id, estimatedTotal: total }, { status: 201 });
    }

    if (body.action === "add-cost") {
      const parsed = z.object({
        jobId: z.string().min(1), category: z.enum(["MATERIAL","LABOUR","EQUIPMENT","TRANSPORT","SUBCONTRACT","OTHER"]),
        description: z.string().trim().min(2).max(300), quantity: positive.default(1),
        unit: z.string().trim().min(1).max(30).default("lot"), unitRate: money,
        incurredAt: dateValue, reference: z.string().max(120).optional(),
        notes: z.string().max(2000).optional().default(""),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check the cost entry details." }, { status: 400 });
      const d = parsed.data;
      const totalAmount = Number((d.quantity * d.unitRate).toFixed(2));
      const cost = await prisma.jobCost.create({ data: { ...d, totalAmount, incurredAt: d.incurredAt ? new Date(d.incurredAt) : new Date(), createdBy: admin.email } });
      await audit("JOB_COST_RECORDED", "CONSTRUCTION_JOB", d.jobId, admin.email, `${d.category}: ${d.description} ₹${totalAmount.toLocaleString("en-IN")}.`);
      return NextResponse.json({ id: cost.id, totalAmount }, { status: 201 });
    }

    if (body.action === "supplier-quote") {
      const parsed = z.object({
        supplierId: z.string().min(1), reference: z.string().max(120).optional(),
        category: z.string().max(100).optional(), productName: z.string().trim().min(2).max(200),
        brand: z.string().max(120).optional(), specification: z.string().max(500).optional(),
        unit: z.string().trim().min(1).max(30), unitRate: money,
        minimumOrder: z.number().finite().positive().optional(),
        validUntil: dateValue, notes: z.string().max(2000).optional(),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check the supplier quotation details and rate." }, { status: 400 });
      const d = parsed.data;
      const quote = await prisma.supplierQuote.create({ data: {
        ...d, validUntil: d.validUntil ? new Date(d.validUntil) : null,
      } });
      await audit("SUPPLIER_QUOTE_CAPTURED", "SUPPLIER_QUOTE", quote.id, admin.email, `Supplier quote captured for ${d.productName} at ₹${d.unitRate.toLocaleString("en-IN")} per ${d.unit}.`);
      return NextResponse.json({ id: quote.id }, { status: 201 });
    }

    if (body.action === "save-boq-batch") {
      const parsed = z.object({
        jobId: z.string().min(1),
        items: z.array(z.object({ code: z.string().max(60).optional(), description: z.string().trim().min(2).max(500), category: z.string().trim().min(2).max(100), unit: z.string().trim().min(1).max(30), quantity: positive, unitRate: money, calculationBasis: z.enum(["MANUAL", "PROJECT_AREA"]).default("MANUAL"), areaFactor: z.number().finite().min(0).max(100000).default(0), notes: z.string().max(2000).optional().default("") })).min(1).max(100),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Provide one or more valid BOQ lines." }, { status: 400 });
      const job = await prisma.constructionJob.findUnique({ where: { id: parsed.data.jobId }, select: { projectAreaSqFt: true } });
      if (!job) return NextResponse.json({ error: "Construction job not found." }, { status: 404 });
      if (parsed.data.items.some((item) => item.calculationBasis === "PROJECT_AREA" && item.areaFactor <= 0)) return NextResponse.json({ error: "Area-based BOQ lines require a positive factor per square foot." }, { status: 400 });
      if (parsed.data.items.some((item) => item.calculationBasis === "PROJECT_AREA") && Number(job.projectAreaSqFt) <= 0) return NextResponse.json({ error: "Set the project area before using area-based BOQ lines." }, { status: 409 });
      const created = await prisma.$transaction(parsed.data.items.map((item) => {
        const quantity = item.calculationBasis === "PROJECT_AREA" ? Number((Number(job.projectAreaSqFt) * item.areaFactor).toFixed(3)) : item.quantity;
        const estimatedTotal = Number((quantity * item.unitRate).toFixed(2));
        return prisma.boqItem.create({ data: { ...item, jobId: parsed.data.jobId, quantity, estimatedTotal } });
      }));
      await audit("BOQ_BATCH_CREATED", "CONSTRUCTION_JOB", parsed.data.jobId, admin.email, `${created.length} BOQ lines added.`);
      return NextResponse.json({ created: created.length }, { status: 201 });
    }

    if (body.action === "update-boq-item") {
      const parsed = z.object({ id: z.string().min(1), description: z.string().trim().min(2).max(500), category: z.string().trim().min(2).max(100), unit: z.string().trim().min(1).max(30), quantity: positive, unitRate: money, calculationBasis: z.enum(["MANUAL", "PROJECT_AREA"]), areaFactor: z.number().finite().min(0).max(100000) }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check the BOQ line details." }, { status: 400 });
      if (parsed.data.calculationBasis === "PROJECT_AREA" && parsed.data.areaFactor <= 0) return NextResponse.json({ error: "Area-based BOQ lines require a positive factor per square foot." }, { status: 400 });
      const existing = await prisma.boqItem.findUnique({ where: { id: parsed.data.id }, include: { job: { select: { projectAreaSqFt: true } } } });
      if (!existing) return NextResponse.json({ error: "BOQ item not found." }, { status: 404 });
      if (existing.approvalStatus === "APPROVED" || existing.approvalStatus === "PENDING_APPROVAL") return NextResponse.json({ error: "Approved or pending-approval BOQ lines are locked. Reject the pending review or request a revision before changing them." }, { status: 409 });
      if (parsed.data.calculationBasis === "PROJECT_AREA" && Number(existing.job.projectAreaSqFt) <= 0) return NextResponse.json({ error: "Set project area before using area-based calculation." }, { status: 409 });
      const quantity = parsed.data.calculationBasis === "PROJECT_AREA" ? Number((Number(existing.job.projectAreaSqFt) * parsed.data.areaFactor).toFixed(3)) : parsed.data.quantity;
      const values = parsed.data;
      const updated = await prisma.boqItem.update({ where: { id: existing.id }, data: { description: values.description, category: values.category, unit: values.unit, unitRate: values.unitRate, calculationBasis: values.calculationBasis, areaFactor: values.areaFactor, quantity, estimatedTotal: Number((quantity * values.unitRate).toFixed(2)), approvalStatus: "DRAFT" } });
      await audit("BOQ_ITEM_UPDATED", "CONSTRUCTION_JOB", existing.jobId, admin.email, `Updated BOQ line ${updated.description}.`);
      return NextResponse.json({ id: updated.id });
    }

    if (body.action === "update-boq-batch") {
      const parsed = z.object({
        jobId: z.string().min(1),
        items: z.array(z.object({ id: z.string().min(1), description: z.string().trim().min(2).max(500), category: z.string().trim().min(2).max(100), unit: z.string().trim().min(1).max(30), quantity: positive, unitRate: money, calculationBasis: z.enum(["MANUAL", "PROJECT_AREA"]), areaFactor: z.number().finite().min(0).max(100000) })).min(1).max(500).refine((items) => new Set(items.map((item) => item.id)).size === items.length, { message: "BOQ item IDs must be unique." }),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check the BOQ batch entries." }, { status: 400 });
      const [job, existing] = await Promise.all([
        prisma.constructionJob.findUnique({ where: { id: parsed.data.jobId }, select: { projectAreaSqFt: true } }),
        prisma.boqItem.findMany({ where: { id: { in: parsed.data.items.map((item) => item.id) }, jobId: parsed.data.jobId }, select: { id: true, approvalStatus: true } }),
      ]);
      if (!job || existing.length !== parsed.data.items.length) return NextResponse.json({ error: "One or more BOQ items do not belong to this project." }, { status: 404 });
      if (existing.some((item) => ["APPROVED", "PENDING_APPROVAL"].includes(item.approvalStatus))) return NextResponse.json({ error: "Approved or pending-review BOQ lines cannot be edited." }, { status: 409 });
      if (parsed.data.items.some((item) => item.calculationBasis === "PROJECT_AREA" && item.areaFactor <= 0)) return NextResponse.json({ error: "Area-based BOQ lines require a positive factor per square foot." }, { status: 400 });
      if (parsed.data.items.some((item) => item.calculationBasis === "PROJECT_AREA") && Number(job.projectAreaSqFt) <= 0) return NextResponse.json({ error: "Set project area before using area-based BOQ calculations." }, { status: 409 });
      const updated = await prisma.$transaction(parsed.data.items.map((item) => {
        const quantity = item.calculationBasis === "PROJECT_AREA" ? Number((Number(job.projectAreaSqFt) * item.areaFactor).toFixed(3)) : item.quantity;
        return prisma.boqItem.update({ where: { id: item.id }, data: { description: item.description, category: item.category, unit: item.unit, quantity, unitRate: item.unitRate, calculationBasis: item.calculationBasis, areaFactor: item.areaFactor, estimatedTotal: Number((quantity * item.unitRate).toFixed(2)), approvalStatus: "DRAFT" } });
      }));
      await audit("BOQ_BATCH_UPDATED", "CONSTRUCTION_JOB", parsed.data.jobId, admin.email, `${updated.length} BOQ lines updated together.`);
      return NextResponse.json({ updated: updated.length });
    }

    if (body.action === "submit-boq") {
      const parsed = z.object({ jobId: z.string().min(1) }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Select a project." }, { status: 400 });
      const updated = await prisma.boqItem.updateMany({ where: { jobId: parsed.data.jobId, approvalStatus: { in: ["DRAFT", "REJECTED"] } }, data: { approvalStatus: "PENDING_APPROVAL", approvedBy: null, approvedAt: null } });
      if (!updated.count) return NextResponse.json({ error: "There are no draft BOQ lines to submit." }, { status: 409 });
      await audit("BOQ_SUBMITTED_FOR_APPROVAL", "CONSTRUCTION_JOB", parsed.data.jobId, admin.email, `${updated.count} BOQ lines submitted.`);
      return NextResponse.json({ submitted: updated.count });
    }

    if (body.action === "approve-boq" || body.action === "reject-boq") {
      if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only the Super Admin can approve or reject a BOQ." }, { status: 403 });
      const parsed = z.object({ jobId: z.string().min(1), note: z.string().max(2000).optional() }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Select a project." }, { status: 400 });
      const status = body.action === "approve-boq" ? "APPROVED" : "REJECTED";
      const updated = await prisma.boqItem.updateMany({ where: { jobId: parsed.data.jobId, approvalStatus: "PENDING_APPROVAL" }, data: { approvalStatus: status, approvedBy: status === "APPROVED" ? admin.email : null, approvedAt: status === "APPROVED" ? new Date() : null, ...(parsed.data.note ? { notes: parsed.data.note } : {}) } });
      if (!updated.count) return NextResponse.json({ error: "No BOQ lines are awaiting approval." }, { status: 409 });
      await audit(`BOQ_${status}`, "CONSTRUCTION_JOB", parsed.data.jobId, admin.email, `${updated.count} BOQ lines ${status.toLowerCase()}.`);
      return NextResponse.json({ updated: updated.count });
    }

    if (body.action === "create-contractor") {
      const parsed = z.object({ contractorName: z.string().trim().min(2).max(160), phone: z.string().max(40).optional(), trade: z.string().trim().min(2).max(100), dailyRate: positive }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Enter a contractor name, trade and valid daily rate." }, { status: 400 });
      const contractor = await prisma.labourContractor.create({ data: parsed.data });
      await audit("LABOUR_CONTRACTOR_CREATED", "LABOUR_CONTRACTOR", contractor.id, admin.email, `${contractor.contractorName} added.`);
      return NextResponse.json({ id: contractor.id }, { status: 201 });
    }

    if (body.action === "record-attendance") {
      const parsed = z.object({ jobId: z.string().min(1), contractorId: z.string().min(1), attendanceDate: z.string().date(), workerCount: z.number().int().min(1).max(1000), presentCount: z.number().int().min(0).max(1000), halfDayCount: z.number().int().min(0).max(1000), dailyRate: positive, notes: z.string().max(2000).optional().default("") }).refine((v) => v.presentCount + v.halfDayCount <= v.workerCount, { message: "Present and half-day counts cannot exceed total workers." }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check the labour attendance counts and date." }, { status: 400 });
      const d = parsed.data;
      const attendanceDate = new Date(`${d.attendanceDate}T00:00:00.000Z`);
      const duplicate = await prisma.labourAttendance.findUnique({ where: { jobId_contractorId_attendanceDate: { jobId: d.jobId, contractorId: d.contractorId, attendanceDate } }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: "Attendance for this contractor and date has already been recorded on this project." }, { status: 409 });
      const totalAmount = Number(((d.presentCount + d.halfDayCount * 0.5) * d.dailyRate).toFixed(2));
      const attendance = await prisma.labourAttendance.create({ data: { ...d, attendanceDate, totalAmount, recordedBy: admin.email } });
      await audit("LABOUR_ATTENDANCE_RECORDED", "CONSTRUCTION_JOB", d.jobId, admin.email, `${d.contractorId}: ${totalAmount.toLocaleString("en-IN")} labour accrual recorded.`);
      return NextResponse.json({ id: attendance.id, totalAmount }, { status: 201 });
    }

    if (body.action === "update-attendance-status") {
      if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only the Super Admin can approve labour attendance." }, { status: 403 });
      const parsed = z.object({ attendanceId: z.string().min(1), status: z.enum(["APPROVED", "REJECTED"]) }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid attendance approval." }, { status: 400 });
      const current = await prisma.labourAttendance.findUnique({ where: { id: parsed.data.attendanceId } });
      if (!current) return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
      if (current.status !== "RECORDED") return NextResponse.json({ error: "Only newly recorded attendance can be approved or rejected." }, { status: 409 });
      const updated = await prisma.labourAttendance.update({ where: { id: parsed.data.attendanceId }, data: { status: parsed.data.status } });
      await audit("LABOUR_ATTENDANCE_STATUS_CHANGED", "LABOUR_ATTENDANCE", updated.id, admin.email, `Attendance ${updated.status.toLowerCase()}.`);
      return NextResponse.json({ id: updated.id, status: updated.status });
    }

    if (body.action === "record-contractor-payment") {
      const parsed = z.object({ jobId: z.string().min(1), contractorId: z.string().min(1), amount: positive, method: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "CARD", "OTHER"]), reference: z.string().max(160).optional(), status: z.enum(["PENDING", "PAID"]).default("PENDING"), notes: z.string().max(2000).optional().default("") }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Enter a valid contractor payment." }, { status: 400 });
      const d = parsed.data;
      const [earnedRows, priorPayments] = await Promise.all([
        prisma.labourAttendance.findMany({ where: { jobId: d.jobId, contractorId: d.contractorId, status: "APPROVED" }, select: { totalAmount: true } }),
        prisma.contractorPayment.findMany({ where: { jobId: d.jobId, contractorId: d.contractorId, status: { in: ["PENDING", "PAID"] } }, select: { amount: true } }),
      ]);
      const earned = earnedRows.reduce((sum, row) => sum + Number(row.totalAmount), 0);
      const alreadyCommitted = priorPayments.reduce((sum, row) => sum + Number(row.amount), 0);
      if (alreadyCommitted + d.amount > earned + 0.01) return NextResponse.json({ error: "Contractor payment exceeds approved labour earnings less prior payments." }, { status: 409 });
      const payment = await prisma.contractorPayment.create({ data: { ...d, paymentNo: ref("NSCP"), paidAt: d.status === "PAID" ? new Date() : null, recordedBy: admin.email } });
      await audit("CONTRACTOR_PAYMENT_RECORDED", "CONSTRUCTION_JOB", d.jobId, admin.email, `${payment.paymentNo}: ₹${d.amount.toLocaleString("en-IN")} ${d.status.toLowerCase()}.`);
      return NextResponse.json({ id: payment.id, paymentNo: payment.paymentNo }, { status: 201 });
    }

    if (body.action === "update-contractor-payment-status") {
      const parsed = z.object({ paymentId: z.string().min(1), status: z.enum(["PENDING", "PAID", "CANCELLED"]) }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid contractor payment status." }, { status: 400 });
      const existing = await prisma.contractorPayment.findUnique({ where: { id: parsed.data.paymentId } });
      if (!existing) return NextResponse.json({ error: "Contractor payment not found." }, { status: 404 });
      if (existing.status !== "PENDING") return NextResponse.json({ error: "Paid or cancelled contractor payments are closed and cannot be changed." }, { status: 409 });
      if (parsed.data.status === "PAID") {
        const [earnedRows, otherPayments] = await Promise.all([
          prisma.labourAttendance.findMany({ where: { jobId: existing.jobId, contractorId: existing.contractorId, status: "APPROVED" }, select: { totalAmount: true } }),
          prisma.contractorPayment.findMany({ where: { jobId: existing.jobId, contractorId: existing.contractorId, status: "PAID", id: { not: existing.id } }, select: { amount: true } }),
        ]);
        const earned = earnedRows.reduce((sum, row) => sum + Number(row.totalAmount), 0);
        const paid = otherPayments.reduce((sum, row) => sum + Number(row.amount), 0);
        if (paid + Number(existing.amount) > earned + 0.01) return NextResponse.json({ error: "Payment exceeds the contractor's approved labour earnings." }, { status: 409 });
      }
      const updated = await prisma.contractorPayment.update({ where: { id: parsed.data.paymentId }, data: { status: parsed.data.status, paidAt: parsed.data.status === "PAID" ? new Date() : null } });
      await audit("CONTRACTOR_PAYMENT_STATUS_CHANGED", "CONTRACTOR_PAYMENT", updated.id, admin.email, `${updated.paymentNo} marked ${updated.status.toLowerCase()}.`);
      return NextResponse.json({ id: updated.id, status: updated.status });
    }

    if (body.action === "create-payment-schedule") {
      const parsed = z.object({ jobId: z.string().min(1), title: z.string().trim().min(2).max(160), dueDate: z.string().date(), amount: positive, notes: z.string().max(2000).optional().default("") }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Enter a milestone name, due date and amount." }, { status: 400 });
      const job = await prisma.constructionJob.findUnique({ where: { id: parsed.data.jobId }, select: { contractAmount: true, paymentSchedules: { select: { amount: true } } } });
      if (!job) return NextResponse.json({ error: "Construction job not found." }, { status: 404 });
      const scheduled = job.paymentSchedules.reduce((sum, item) => sum + Number(item.amount), 0);
      if (scheduled + parsed.data.amount > Number(job.contractAmount) + 0.01) return NextResponse.json({ error: "Payment milestones cannot exceed the approved contract value." }, { status: 409 });
      const schedule = await prisma.customerPaymentSchedule.create({ data: { ...parsed.data, dueDate: new Date(`${parsed.data.dueDate}T00:00:00.000Z`) } });
      await audit("CUSTOMER_PAYMENT_SCHEDULE_CREATED", "CONSTRUCTION_JOB", schedule.jobId, admin.email, `${schedule.title}: ₹${parsed.data.amount.toLocaleString("en-IN")}.`);
      return NextResponse.json({ id: schedule.id }, { status: 201 });
    }

    if (body.action === "submit-po-approval") {
      const parsed = z.object({ purchaseOrderId: z.string().min(1) }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Select a purchase order." }, { status: 400 });
      const po = await prisma.purchaseOrder.findUnique({ where: { id: parsed.data.purchaseOrderId }, include: { items: { include: { boqItem: true } } } });
      if (!po || po.status !== "DRAFT") return NextResponse.json({ error: "Only draft purchase orders can be submitted." }, { status: 409 });
      if (!po.items.length || po.items.some((item) => !item.boqItem || item.boqItem.approvalStatus !== "APPROVED" || item.boqItem.jobId !== po.jobId)) return NextResponse.json({ error: "Every purchase order line must reference an approved BOQ line for this project." }, { status: 409 });
      const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { approvalStatus: "PENDING_APPROVAL", submittedAt: new Date(), approvedAt: null, approvedBy: null } });
      await audit("PURCHASE_ORDER_SUBMITTED", "PURCHASE_ORDER", po.id, admin.email, `${po.poNumber} submitted for approval.`);
      return NextResponse.json({ id: updated.id, approvalStatus: updated.approvalStatus });
    }

    if (body.action === "approve-po" || body.action === "reject-po") {
      const parsed = z.object({ purchaseOrderId: z.string().min(1), note: z.string().max(2000).optional() }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Select a purchase order." }, { status: 400 });
      const po = await prisma.purchaseOrder.findUnique({ where: { id: parsed.data.purchaseOrderId } });
      if (!po || po.approvalStatus !== "PENDING_APPROVAL") return NextResponse.json({ error: "Purchase order is not awaiting approval." }, { status: 409 });
      if (po.createdBy === admin.email) return NextResponse.json({ error: "The purchase order creator cannot approve their own order." }, { status: 403 });
      if (body.action === "approve-po" && Number(po.totalAmount) > purchaseOrderSuperAdminThreshold && admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: `Purchase orders above ₹${purchaseOrderSuperAdminThreshold.toLocaleString("en-IN")} require Super Admin approval.` }, { status: 403 });
      const status = body.action === "approve-po" ? "APPROVED" : "REJECTED";
      const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { approvalStatus: status, approvedAt: status === "APPROVED" ? new Date() : null, approvedBy: status === "APPROVED" ? admin.email : null, approvalNote: parsed.data.note || "" } });
      await audit(`PURCHASE_ORDER_${status}`, "PURCHASE_ORDER", po.id, admin.email, `${po.poNumber} ${status.toLowerCase()}.`);
      return NextResponse.json({ id: updated.id, approvalStatus: updated.approvalStatus });
    }

    if (body.action === "update-po-status") {
      const parsed = z.object({
        purchaseOrderId: z.string().min(1),
        status: z.enum(["DRAFT","SENT","PARTIALLY_RECEIVED","RECEIVED","CANCELLED"]),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid purchase order status." }, { status: 400 });
      const current = await prisma.purchaseOrder.findUnique({ where: { id: parsed.data.purchaseOrderId }, include: { items: true } });
      if (!current) return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
      const hasReceived = current.items.some((item) => Number(item.receivedQty) > 0);
      const isComplete = current.items.every((item) => Number(item.receivedQty) >= Number(item.quantity));
      if (parsed.data.status === "SENT" && current.approvalStatus !== "APPROVED") return NextResponse.json({ error: "Purchase order must be approved before it can be sent to the supplier." }, { status: 409 });
      if (["PARTIALLY_RECEIVED", "RECEIVED"].includes(parsed.data.status) && !["SENT", "PARTIALLY_RECEIVED"].includes(current.status)) return NextResponse.json({ error: "Only a sent purchase order can be marked received." }, { status: 409 });
      if (parsed.data.status === "RECEIVED" && !isComplete) return NextResponse.json({ error: "Record all item deliveries before closing this purchase order as received." }, { status: 409 });
      if (parsed.data.status === "PARTIALLY_RECEIVED" && (!hasReceived || isComplete)) return NextResponse.json({ error: "Partially received status requires some, but not all, items to be delivered." }, { status: 409 });
      if (current.status !== "DRAFT" && parsed.data.status === "DRAFT") return NextResponse.json({ error: "A sent purchase order cannot be moved back to draft." }, { status: 409 });
      if (hasReceived && ["DRAFT", "SENT"].includes(parsed.data.status)) return NextResponse.json({ error: "A purchase order with recorded deliveries cannot return to draft or sent status." }, { status: 409 });
      if (parsed.data.status === "CANCELLED" && hasReceived) return NextResponse.json({ error: "A purchase order with received items cannot be cancelled. Resolve the remaining quantities instead." }, { status: 409 });
      if (current.status === "RECEIVED" || current.status === "CANCELLED") return NextResponse.json({ error: "Closed purchase orders cannot be reopened or changed." }, { status: 409 });
      const po = await prisma.purchaseOrder.update({ where: { id: parsed.data.purchaseOrderId }, data: { status: parsed.data.status } });
      await audit("PURCHASE_ORDER_STATUS_CHANGED", "PURCHASE_ORDER", po.id, admin.email, `Purchase order status changed to ${po.status}.`);
      return NextResponse.json({ id: po.id, status: po.status });
    }

    if (body.action === "create-po") {
      const parsed = z.object({
        jobId: z.string().min(1), supplierId: z.string().min(1), supplierQuoteId: z.string().optional().nullable(), expectedDate: dateValue,
        taxAmount: money.default(0), notes: z.string().max(3000).optional().default(""),
        items: z.array(z.object({ description: z.string().trim().min(2).max(300), boqItemId: z.string().min(1), unit: z.string().min(1).max(30), quantity: positive, unitRate: money })).min(1).max(100),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Add at least one valid purchase order item." }, { status: 400 });
      const d = parsed.data;
      let quoteNote = "";
      if (d.supplierQuoteId) {
        const quote = await prisma.supplierQuote.findUnique({ where: { id: d.supplierQuoteId } });
        if (!quote || quote.supplierId !== d.supplierId) return NextResponse.json({ error: "Selected supplier quotation does not match the selected supplier." }, { status: 409 });
        if (quote.validUntil && quote.validUntil.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: "Selected supplier quotation has expired. Capture a current quotation before ordering." }, { status: 409 });
        if (d.items.length !== 1 || d.items[0].unit !== quote.unit || Math.abs(d.items[0].unitRate - Number(quote.unitRate)) > 0.01) return NextResponse.json({ error: "Purchase order line must retain the selected quotation's unit and rate." }, { status: 409 });
        quoteNote = `Supplier quote reference: ${quote.reference || quote.id}.`;
      }
      const boqIds = [...new Set(d.items.map((item) => item.boqItemId))];
      const approvedBoq = await prisma.boqItem.findMany({ where: { id: { in: boqIds }, jobId: d.jobId, approvalStatus: "APPROVED" } });
      if (approvedBoq.length !== boqIds.length) return NextResponse.json({ error: "Every purchase order line must link to an approved BOQ item for this job." }, { status: 409 });
      const existingOrders = await prisma.purchaseOrderItem.findMany({ where: { boqItemId: { in: boqIds }, purchaseOrder: { is: { status: { not: "CANCELLED" }, approvalStatus: { not: "REJECTED" } } } }, select: { boqItemId: true, quantity: true } });
      for (const boq of approvedBoq) {
        const alreadyOrdered = existingOrders.filter((line) => line.boqItemId === boq.id).reduce((sum, line) => sum + Number(line.quantity), 0);
        const requested = d.items.filter((line) => line.boqItemId === boq.id).reduce((sum, line) => sum + line.quantity, 0);
        if (alreadyOrdered + requested > Number(boq.quantity) + 0.0005) return NextResponse.json({ error: `Purchase quantity for ${boq.description} exceeds the approved BOQ balance.` }, { status: 409 });
      }
      const items = d.items.map((item) => ({ ...item, totalAmount: Number((item.quantity * item.unitRate).toFixed(2)) }));
      const subtotal = Number(items.reduce((sum, item) => sum + item.totalAmount, 0).toFixed(2));
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber: ref("NSPO"), jobId: d.jobId, supplierId: d.supplierId,
          expectedDate: d.expectedDate ? new Date(d.expectedDate) : null,
          subtotal, taxAmount: d.taxAmount, totalAmount: Number((subtotal + d.taxAmount).toFixed(2)),
          notes: [d.notes, quoteNote].filter(Boolean).join("\n"), createdBy: admin.email, items: { create: items },
        },
      });
      await audit("PURCHASE_ORDER_CREATED", "CONSTRUCTION_JOB", d.jobId, admin.email, `Purchase order ${po.poNumber} created for ₹${Number(po.totalAmount).toLocaleString("en-IN")}.`);
      return NextResponse.json({ id: po.id, poNumber: po.poNumber, totalAmount: po.totalAmount.toString() }, { status: 201 });
    }

    if (body.action === "record-delivery") {
      const parsed = z.object({
        purchaseOrderId: z.string().min(1), deliveryRef: z.string().max(120).optional(),
        receivedBy: z.string().trim().min(2).max(120),
        notes: z.string().max(2000).optional().default(""),
        items: z.array(z.object({ itemId: z.string().min(1), receivedQty: z.number().finite().positive() })).min(1).max(100).refine((items) => new Set(items.map((item) => item.itemId)).size === items.length, { message: "Each purchase order line can appear only once per delivery." }),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Provide the receiver and quantities delivered." }, { status: 400 });
      const d = parsed.data;
      const po = await prisma.purchaseOrder.findUnique({ where: { id: d.purchaseOrderId }, include: { items: true } });
      if (!po || ["DRAFT", "CANCELLED", "RECEIVED"].includes(po.status)) return NextResponse.json({ error: "Send the purchase order before recording delivery; closed orders cannot receive items." }, { status: 409 });
      for (const line of d.items) {
        const existing = po.items.find((item) => item.id === line.itemId);
        if (!existing || Number(existing.receivedQty) + line.receivedQty > Number(existing.quantity)) {
          return NextResponse.json({ error: "A delivered quantity exceeds the outstanding purchase quantity." }, { status: 409 });
        }
      }
      await prisma.$transaction(async (tx) => {
        for (const line of d.items) {
          const existing = po.items.find((item) => item.id === line.itemId);
          if (!existing) throw new OperationConflictError("A purchase order line is no longer available.");
          const changed = await tx.purchaseOrderItem.updateMany({ where: { id: line.itemId, purchaseOrderId: po.id, receivedQty: { lte: Number(existing.quantity) - line.receivedQty } }, data: { receivedQty: { increment: line.receivedQty } } });
          if (changed.count !== 1) throw new OperationConflictError("Another delivery changed the outstanding quantity. Refresh and try again.");
        }
        await tx.purchaseDelivery.create({ data: {
          purchaseOrderId: po.id, deliveryRef: d.deliveryRef, receivedBy: d.receivedBy, notes: d.notes,
          items: { create: d.items.map((line) => ({ purchaseOrderItemId: line.itemId, quantityReceived: line.receivedQty })) },
        } });
        const refreshed = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
        const complete = refreshed.every((item) => Number(item.receivedQty) >= Number(item.quantity));
        const partial = refreshed.some((item) => Number(item.receivedQty) > 0);
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? "RECEIVED" : partial ? "PARTIALLY_RECEIVED" : po.status } });
        await tx.activityLog.create({ data: { action: "PURCHASE_DELIVERY_RECORDED", entityType: "PURCHASE_ORDER", entityId: po.id, actorEmail: admin.email, details: `Delivery recorded by ${d.receivedBy}.` } });
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "record-payment") {
      const parsed = z.object({
        jobId: z.string().min(1), scheduleId: z.string().optional().nullable(), amount: positive,
        method: z.enum(["CASH","BANK_TRANSFER","UPI","CHEQUE","CARD","OTHER"]),
        status: z.enum(["PENDING","CLEARED","FAILED","REFUNDED"]).default("PENDING"),
        reference: z.string().max(160).optional(), paidAt: dateValue,
        notes: z.string().max(2000).optional().default(""),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check the payment amount and method." }, { status: 400 });
      const d = parsed.data;
      if (d.scheduleId) {
        const schedule = await prisma.customerPaymentSchedule.findFirst({ where: { id: d.scheduleId, jobId: d.jobId }, include: { payments: { where: { status: "CLEARED" }, select: { amount: true } } } });
        if (!schedule) return NextResponse.json({ error: "The selected payment milestone does not belong to this project." }, { status: 400 });
        const alreadyCleared = schedule.payments.reduce((sum, row) => sum + Number(row.amount), 0);
        if (d.status === "CLEARED" && alreadyCleared + d.amount > Number(schedule.amount) + 0.01) return NextResponse.json({ error: "This payment would exceed the milestone balance." }, { status: 409 });
      }
      const payment = await prisma.customerPayment.create({ data: {
        jobId: d.jobId, scheduleId: d.scheduleId || null, receiptNo: ref("NSR"), amount: d.amount, method: d.method, status: d.status,
        reference: d.reference, paidAt: d.paidAt ? new Date(d.paidAt) : new Date(), notes: d.notes, recordedBy: admin.email,
      } });
      await audit("CUSTOMER_PAYMENT_RECORDED", "CONSTRUCTION_JOB", d.jobId, admin.email, `Payment ${payment.receiptNo} recorded: ₹${d.amount.toLocaleString("en-IN")} (${d.status}).`);
      return NextResponse.json({ id: payment.id, receiptNo: payment.receiptNo }, { status: 201 });
    }

    if (body.action === "update-payment-status") {
      const parsed = z.object({
        paymentId: z.string().min(1),
        status: z.enum(["PENDING","CLEARED","FAILED","REFUNDED"]),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid payment status." }, { status: 400 });
      const currentPayment = await prisma.customerPayment.findUnique({ where: { id: parsed.data.paymentId } });
      if (!currentPayment) return NextResponse.json({ error: "Customer payment not found." }, { status: 404 });
      if (parsed.data.status === "CLEARED" && currentPayment.scheduleId) {
        const schedule = await prisma.customerPaymentSchedule.findUnique({ where: { id: currentPayment.scheduleId }, include: { payments: { where: { status: "CLEARED", id: { not: currentPayment.id } }, select: { amount: true } } } });
        if (schedule) { const cleared = schedule.payments.reduce((sum, row) => sum + Number(row.amount), 0); if (cleared + Number(currentPayment.amount) > Number(schedule.amount) + 0.01) return NextResponse.json({ error: "Clearing this receipt would exceed the milestone amount." }, { status: 409 }); }
      }
      const payment = await prisma.customerPayment.update({ where: { id: parsed.data.paymentId }, data: { status: parsed.data.status } });
      await audit("CUSTOMER_PAYMENT_STATUS_CHANGED", "CUSTOMER_PAYMENT", payment.id, admin.email, `Receipt ${payment.receiptNo} status changed to ${payment.status}.`);
      return NextResponse.json({ id: payment.id, status: payment.status });
    }

    if (body.action === "add-progress") {
      const parsed = z.object({
        jobId: z.string().min(1), title: z.string().trim().min(2).max(160),
        description: z.string().max(5000).optional().default(""),
        progressPercent: z.number().int().min(0).max(100),
        updateDate: dateValue, photos: z.array(z.string().url()).max(20).optional().default([]),
        blockers: z.string().max(3000).optional().default(""),
        weather: z.string().max(120).optional().default(""), crewCount: z.number().int().min(0).max(1000).optional().default(0),
        workDone: z.string().max(5000).optional().default(""), materialsUsed: z.string().max(3000).optional().default(""),
        equipmentUsed: z.string().max(3000).optional().default(""), safetyNotes: z.string().max(3000).optional().default(""),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Check the progress update details." }, { status: 400 });
      const d = parsed.data;
      const update = await prisma.projectProgressUpdate.create({ data: {
        ...d, updateDate: d.updateDate ? new Date(d.updateDate) : new Date(), createdBy: admin.email,
      } });
      await audit("PROJECT_PROGRESS_UPDATED", "CONSTRUCTION_JOB", d.jobId, admin.email, `${d.progressPercent}% — ${d.title}.`);
      return NextResponse.json({ id: update.id }, { status: 201 });
    }

    if (body.action === "update-job-status") {
      const parsed = z.object({
        jobId: z.string().min(1),
        status: z.enum(["PLANNING","APPROVED","IN_PROGRESS","ON_HOLD","COMPLETED","CANCELLED"]),
      }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid project status." }, { status: 400 });
      const updated = await prisma.constructionJob.update({
        where: { id: parsed.data.jobId },
        data: { status: parsed.data.status, ...(parsed.data.status === "COMPLETED" ? { completedAt: new Date() } : {}) },
      });
      await audit("CONSTRUCTION_JOB_STATUS_CHANGED", "CONSTRUCTION_JOB", updated.id, admin.email, `Status changed to ${updated.status}.`);
      return NextResponse.json({ id: updated.id, status: updated.status });
    }

    return NextResponse.json({ error: "Unsupported operations action." }, { status: 400 });
  } catch (error) {
    if (error instanceof OperationConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    logApiError("/api/admin/operations POST", error);
    return NextResponse.json(databaseErrorResponse(error, "The construction operation could not be saved."), { status: 503 });
  }
}
