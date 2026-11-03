
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createQuotationRecord } from "@/lib/quotation-record";
import { calculateEstimate, QuotationInputError, quotationSubmissionSchema } from "@/lib/quotations";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";

async function refreshQuotationLink(quotationId: string) {
  const publicToken = randomBytes(32).toString("base64url");
  const publicTokenHash = createHash("sha256").update(publicToken).digest("hex");
  await prisma.quotation.update({ where: { id: quotationId }, data: { publicTokenHash } });
  return `/quote/${publicToken}`;
}

export async function POST(request: Request) {
  const parsed = quotationSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the required customer, project and area details." }, { status: 400 });
  const data = parsed.data;

  try {
    if (!await consumeRateLimit(request, "public-quotation", 8)) {
      return NextResponse.json({ error: "Too many quotation requests. Please try again later." }, { status: 429 });
    }

    const existingQuote = await prisma.quotation.findUnique({ where: { submissionId: data.submissionId }, select: { id: true, quotationNo: true, totalAmount: true } });
    if (existingQuote) {
      const quotationUrl = await refreshQuotationLink(existingQuote.id);
      return NextResponse.json({ ok: true, duplicate: true, quotationId: existingQuote.id, quotationNo: existingQuote.quotationNo, totalAmount: existingQuote.totalAmount.toString(), quotationUrl });
    }

    const estimate = await calculateEstimate(data);
    if (estimate.items.some((item) => !item.includedInPackage) && !data.confirmUpgrades) {
      return NextResponse.json({ error: "Confirm the clearly itemised specification upgrades before requesting this estimate." }, { status: 409 });
    }
    const { quotation, quotationUrl } = await createQuotationRecord(data, estimate, "customer quotation builder");

    return NextResponse.json({
      ok: true,
      quotationId: quotation.id,
      quotationNo: quotation.quotationNo,
      totalAmount: quotation.totalAmount.toString(),
      quotationUrl,
      message: "Your indicative estimate has been recorded. The team will confirm scope and specifications before issuing a final quotation.",
    }, { status: 201 });
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      try {
        const duplicate = await prisma.quotation.findUnique({ where: { submissionId: data.submissionId }, select: { id: true, quotationNo: true, totalAmount: true } });
        if (duplicate) {
          const quotationUrl = await refreshQuotationLink(duplicate.id);
          return NextResponse.json({ ok: true, duplicate: true, quotationId: duplicate.id, quotationNo: duplicate.quotationNo, totalAmount: duplicate.totalAmount.toString(), quotationUrl });
        }
      } catch (lookupError) {
        logApiError("/api/quotations POST duplicate lookup", lookupError);
        return NextResponse.json(databaseErrorResponse(lookupError, "Your estimate may already be recorded, but its status could not be verified. Please contact the team."), { status: 503 });
      }
    }
    if (error instanceof QuotationInputError) return NextResponse.json({ error: error.message }, { status: 422 });
    logApiError("/api/quotations POST", error);
    return NextResponse.json(databaseErrorResponse(error, "Your estimate could not be saved. Please try again or contact the team."), { status: 503 });
  }
}
