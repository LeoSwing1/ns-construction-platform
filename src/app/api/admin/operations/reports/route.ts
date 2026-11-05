import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageSettings, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logApiError } from "@/lib/api-errors";
import { databaseErrorResponse } from "@/lib/prisma-errors";

export async function GET(request: Request) {
  const auth = await getAdminOrResponse();
  if (auth.response) return auth.response;
  if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const month = new URL(request.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const parsed = z.string().regex(/^\d{4}-\d{2}$/).safeParse(month);
  if (!parsed.success || Number(month.slice(5)) < 1 || Number(month.slice(5)) > 12) return NextResponse.json({ error: "Month must use a valid YYYY-MM value." }, { status: 400 });
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  try {
    const [jobs, costs, labour, deliveries, collections, contractorPayments] = await Promise.all([
      prisma.constructionJob.findMany({ where: { status: { not: "CANCELLED" } }, select: { id: true, jobNo: true, name: true, contractAmount: true, budgetAmount: true, costs: { select: { totalAmount: true } }, purchaseOrders: { include: { items: true } }, labourAttendance: { where: { status: "APPROVED" }, select: { totalAmount: true } }, payments: { where: { status: "CLEARED" }, select: { amount: true } } } }),
      prisma.jobCost.findMany({ where: { incurredAt: { gte: start, lt: end } }, include: { job: { select: { id: true, jobNo: true, name: true } } } }),
      prisma.labourAttendance.findMany({ where: { status: "APPROVED", attendanceDate: { gte: start, lt: end } }, include: { job: { select: { id: true, jobNo: true, name: true } }, contractor: { select: { contractorName: true, trade: true } } } }),
      prisma.purchaseDelivery.findMany({ where: { deliveredAt: { gte: start, lt: end } }, include: { purchaseOrder: { include: { job: { select: { id: true, jobNo: true, name: true } }, items: true } }, items: true } }),
      prisma.customerPayment.findMany({ where: { status: "CLEARED", paidAt: { gte: start, lt: end } }, include: { job: { select: { id: true, jobNo: true, name: true } } } }),
      prisma.contractorPayment.findMany({ where: { status: "PAID", paidAt: { gte: start, lt: end } }, include: { job: { select: { id: true, jobNo: true, name: true } }, contractor: { select: { contractorName: true } } } }),
    ]);
    const receivedValue = (delivery: typeof deliveries[number]) => delivery.items.reduce((sum, line) => {
      const item = delivery.purchaseOrder.items.find((candidate) => candidate.id === line.purchaseOrderItemId);
      return sum + (item ? Number(line.quantityReceived) * Number(item.unitRate) : 0);
    }, 0) * (Number(delivery.purchaseOrder.subtotal) > 0 ? 1 + Number(delivery.purchaseOrder.taxAmount) / Number(delivery.purchaseOrder.subtotal) : 1);
    const jobRows = jobs.map((job) => {
      const direct = job.costs.reduce((sum, cost) => sum + Number(cost.totalAmount), 0);
      const procurement = job.purchaseOrders.reduce((sum, po) => {
        const received = po.items.reduce((subtotal, item) => subtotal + Number(item.receivedQty) * Number(item.unitRate), 0);
        const taxRatio = Number(po.subtotal) > 0 ? Number(po.taxAmount) / Number(po.subtotal) : 0;
        return sum + received * (1 + taxRatio);
      }, 0);
      const labourCost = job.labourAttendance.reduce((sum, entry) => sum + Number(entry.totalAmount), 0);
      const cost = direct + procurement + labourCost;
      const collected = job.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      return { id: job.id, jobNo: job.jobNo, name: job.name, contractValue: Number(job.contractAmount), approvedBudget: Number(job.budgetAmount), directCosts: direct, procurementReceived: procurement, approvedLabour: labourCost, actualCost: cost, projectContribution: Number(job.contractAmount) - cost, collected, customerOutstanding: Math.max(0, Number(job.contractAmount) - collected) };
    });
    const directCostTotal = costs.reduce((sum, row) => sum + Number(row.totalAmount), 0);
    const labourTotal = labour.reduce((sum, row) => sum + Number(row.totalAmount), 0);
    const procurementTotal = deliveries.reduce((sum, delivery) => sum + receivedValue(delivery), 0);
    const customerCollections = collections.reduce((sum, row) => sum + Number(row.amount), 0);
    const contractorCashPaid = contractorPayments.reduce((sum, row) => sum + Number(row.amount), 0);
    const costsByCategory = costs.reduce<Record<string, number>>((groups, row) => { groups[row.category] = (groups[row.category] || 0) + Number(row.totalAmount); return groups; }, {});
    costsByCategory.LABOUR_ATTENDANCE = labourTotal;
    costsByCategory.RECEIVED_PROCUREMENT = procurementTotal;
    return NextResponse.json({ month, totals: { directCosts: directCostTotal, labourAccrual: labourTotal, receivedProcurement: procurementTotal, accruedProjectCosts: directCostTotal + labourTotal + procurementTotal, customerCollections, contractorCashPaid, collectionsLessContractorPayments: customerCollections - contractorCashPaid, costsByCategory }, jobs: jobRows, entries: { costs, labour, deliveries: deliveries.map((d) => ({ id: d.id, deliveryRef: d.deliveryRef, deliveredAt: d.deliveredAt, job: d.purchaseOrder.job, value: receivedValue(d) })), collections, contractorPayments } });
  } catch (error) {
    logApiError("/api/admin/operations/reports GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Financial reports could not be generated."), { status: 503 });
  }
}
