import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-errors";
import { canManageLeads, getAdminOrResponse } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  try {
    const canViewLeads = canManageLeads(admin);
    const [projects, posts, publishedPosts, leadSummary, quotationSummary] = await Promise.all([
      prisma.project.count(),
      prisma.blogPost.count(),
      prisma.blogPost.count({ where: { status: "PUBLISHED" } }),
      canViewLeads ? Promise.all([
        prisma.enquiry.count(),
        prisma.enquiry.count({ where: { status: "NEW" } }),
        prisma.enquiry.count({ where: { followUpAt: { lte: new Date() }, status: { notIn: ["WON", "LOST"] } } }),
        prisma.enquiry.count({ where: { emailDeliveryStatus: { in: ["FAILED", "PARTIAL"] } } }),
        prisma.enquiry.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, phone: true, projectType: true, status: true, createdAt: true },
        }),
      ]) : Promise.resolve(null),
      canViewLeads ? Promise.all([
        prisma.quotation.count(),
        prisma.quotation.count({ where: { status: "DRAFT" } }),
        prisma.quotation.count({ where: { status: "SENT" } }),
        prisma.quotation.count({ where: { status: "ACCEPTED" } }),
        prisma.quotation.count({ where: { status: "REJECTED" } }),
        prisma.quotation.aggregate({ _sum: { totalAmount: true } }),
        prisma.quotation.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, quotationNo: true, totalAmount: true, status: true, createdAt: true, customer: { select: { name: true } } },
        }),
      ]) : Promise.resolve(null),
    ]);
    const [enquiries, newEnquiries, followUpsDue, deliveryIssues, recent] = leadSummary ?? [null, null, null, null, []];
    const [quotationCount, draftQuotations, sentQuotations, acceptedQuotations, rejectedQuotations, quotationValue, recentQuotations] = quotationSummary ?? [null, null, null, null, null, null, []];
    return NextResponse.json({
      role: admin.role, canViewLeads, projects, posts, publishedPosts, enquiries, newEnquiries, followUpsDue, deliveryIssues, recent,
      quotationCount, draftQuotations, sentQuotations, acceptedQuotations, rejectedQuotations,
      quotationValue: quotationValue?._sum.totalAmount?.toString() ?? null,
      recentQuotations: recentQuotations.map((item) => ({ ...item, totalAmount: item.totalAmount.toString() })),
    });
  } catch (error) {
    logApiError("/api/admin/summary GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Dashboard data is temporarily unavailable."), { status: 503 });
  }
}
