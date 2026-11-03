import { NextResponse } from "next/server";
import { canManageLeads, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEnquiryNotifications } from "@/lib/notifications";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageLeads(admin)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  try {
    const enquiry = await prisma.enquiry.findUnique({ where: { id }, include: { emailDeliveries: { orderBy: { attemptedAt: "desc" } } } });
    if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    const successfulRecipients = new Set(enquiry.emailDeliveries.filter((attempt) => attempt.status === "SENT").map((attempt) => attempt.recipient));
    const result = await sendEnquiryNotifications(enquiry, successfulRecipients);
    if (result.attempts.length > 0) {
      await prisma.emailDeliveryAttempt.createMany({
        data: result.attempts.map((attempt) => ({
          enquiryId: id,
          recipient: attempt.recipient,
          status: attempt.status,
          providerMessageId: attempt.providerMessageId,
          error: attempt.error,
        })),
      });
    }
    const hasSent = successfulRecipients.size > 0 || result.attempts.some((attempt) => attempt.status === "SENT");
    const hasFailure = result.attempts.some((attempt) => attempt.status === "FAILED");
    const status = hasFailure && hasSent ? "PARTIAL" : hasFailure ? "FAILED" : hasSent ? "SENT" : "NOT_CONFIGURED";
    await prisma.$transaction([
      prisma.enquiry.update({ where: { id }, data: { emailDeliveryStatus: status, emailAttempts: { increment: result.attempts.length ? 1 : 0 }, emailLastAttemptAt: result.attempts.length ? new Date() : enquiry.emailLastAttemptAt } }),
      prisma.activityLog.create({ data: { action: "EMAIL_RETRY", entityType: "ENQUIRY", entityId: id, enquiryId: id, actorEmail: admin.email, details: `Enquiry notifications status: ${status}.` } }),
    ]);
    return NextResponse.json({ ok: true, status, attempted: result.attempts.length });
  } catch (error) {
    console.error("Enquiry email retry failed", { enquiryId: id, actor: admin.email, code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return NextResponse.json(databaseErrorResponse(error, "Notification retry could not be completed."), { status: 503 });
  }
}
