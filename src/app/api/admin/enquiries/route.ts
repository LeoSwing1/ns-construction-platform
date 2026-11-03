import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageLeads, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";

export async function GET(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const search = query.get("q")?.trim().slice(0, 100);
  const status = query.get("status");
  const allowedStatuses = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"] as const;
  if (status && !allowedStatuses.includes(status as typeof allowedStatuses[number])) {
    return NextResponse.json({ error: "Invalid enquiry status filter." }, { status: 400 });
  }
  try {
    const items = await prisma.enquiry.findMany({
      where: {
        ...(status ? { status: status as typeof allowedStatuses[number] } : {}),
        ...(search ? { OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
        ] } : {}),
      },
      orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
      take: 500,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    return NextResponse.json(items);
  } catch (error) {
    logApiError("/api/admin/enquiries GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Enquiries are temporarily unavailable."), { status: 503 });
  }
}

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"]).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().min(1).max(2000).optional(),
}).refine((value) => value.status !== undefined || value.assignedToId !== undefined || value.followUpAt !== undefined || value.note !== undefined);

export async function PATCH(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid enquiry update." }, { status: 400 });
  const { id, note, ...changes } = parsed.data;
  if ((changes.assignedToId !== undefined || changes.followUpAt !== undefined) && admin.role === "SALES") {
    return NextResponse.json({ error: "Only an administrator can assign leads or change follow-up ownership." }, { status: 403 });
  }

  try {
    const data = {
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      ...(changes.assignedToId !== undefined ? { assignedToId: changes.assignedToId } : {}),
      ...(changes.followUpAt !== undefined ? { followUpAt: changes.followUpAt ? new Date(changes.followUpAt) : null } : {}),
    };
    const updated = await prisma.$transaction(async (transaction) => {
      const item = await transaction.enquiry.update({ where: { id }, data, include: { assignedTo: { select: { id: true, name: true, email: true, role: true } } } });
      const events = [
        ...(changes.status ? [{ action: "STATUS_CHANGED", details: `Lead status changed to ${changes.status}.` }] : []),
        ...(changes.assignedToId !== undefined ? [{ action: "ASSIGNMENT_CHANGED", details: changes.assignedToId ? "Lead assignment updated." : "Lead unassigned." }] : []),
        ...(changes.followUpAt !== undefined ? [{ action: "FOLLOW_UP_CHANGED", details: changes.followUpAt ? `Follow-up set for ${changes.followUpAt}.` : "Follow-up reminder cleared." }] : []),
        ...(note ? [{ action: "NOTE_ADDED", details: note }] : []),
      ];
      if (events.length) await transaction.activityLog.createMany({
        data: events.map((event) => ({ ...event, entityType: "ENQUIRY", entityId: id, enquiryId: id, actorEmail: admin.email })),
      });
      return item;
    });
    return NextResponse.json(updated);
  } catch (error) {
    logApiError("/api/admin/enquiries PATCH", error);
    const code = prismaErrorCode(error);
    return code === "P2025"
      ? NextResponse.json({ error: "Enquiry could not be updated. Check that the record and assigned user exist.", code: "RECORD_NOT_FOUND" }, { status: 404 })
      : NextResponse.json(databaseErrorResponse(error, "Enquiry could not be updated."), { status: 503 });
  }
}
