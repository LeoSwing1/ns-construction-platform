import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-errors";
import { canManageLeads, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        package: true,
        items: { orderBy: { createdAt: "asc" } },
        revisions: { orderBy: { revision: "asc" } },
        activities: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!quotation) return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
    return NextResponse.json(quotation);
  } catch (error) {
    logApiError("/api/admin/quotations/[id] GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Quotation is temporarily unavailable."), { status: 503 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  try {
    const item = await prisma.quotation.findUnique({ where: { id }, select: { id: true, status: true, quotationNo: true } });
    if (!item) return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
    if (item.status !== "DRAFT") return NextResponse.json({ error: "Only draft quotations can be deleted. Issued quotation records are retained for audit history." }, { status: 409 });
    await prisma.$transaction([
      prisma.activityLog.create({ data: { action: "DRAFT_QUOTATION_DELETED", entityType: "QUOTATION", entityId: item.id, actorEmail: admin.email, details: `Draft quotation ${item.quotationNo} deleted.` } }),
      prisma.quotation.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("/api/admin/quotations/[id] DELETE", error);
    return prismaErrorCode(error) === "P2025"
      ? NextResponse.json({ error: "Quotation not found.", code: "RECORD_NOT_FOUND" }, { status: 404 })
      : prismaErrorCode(error) === "P2003"
        ? NextResponse.json({ error: "The quotation could not be deleted because related records still reference it.", code: "QUOTATION_DELETE_CONFLICT" }, { status: 409 })
        : NextResponse.json(databaseErrorResponse(error, "Quotation could not be deleted."), { status: 503 });
  }
}
