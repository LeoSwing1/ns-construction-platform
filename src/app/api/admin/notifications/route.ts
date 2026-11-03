import { NextResponse } from "next/server";
import { canManageLeads, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";

export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  try {
    const now = new Date();
    const items = await prisma.enquiry.findMany({
      where: {
        OR: [
          { followUpAt: { lte: now }, status: { notIn: ["WON", "LOST"] } },
          { emailDeliveryStatus: { in: ["FAILED", "PARTIAL"] } },
        ],
      },
      orderBy: [{ followUpAt: "asc" }, { updatedAt: "desc" }],
      take: 100,
      select: { id: true, name: true, phone: true, email: true, projectType: true, status: true, followUpAt: true, emailDeliveryStatus: true, emailAttempts: true, updatedAt: true },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Admin notification centre could not be loaded", { code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return NextResponse.json(databaseErrorResponse(error, "Notifications are temporarily unavailable."), { status: 503 });
  }
}
