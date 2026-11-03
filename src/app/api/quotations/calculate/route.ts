import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-errors";
import { databaseErrorResponse } from "@/lib/prisma-errors";
import { calculateEstimate, estimateInputSchema, QuotationInputError } from "@/lib/quotations";

export async function POST(request: Request) {
  const parsed = estimateInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid package, area and material selection." }, { status: 400 });
  try {
    return NextResponse.json(await calculateEstimate(parsed.data));
  } catch (error) {
    if (error instanceof QuotationInputError) return NextResponse.json({ error: error.message }, { status: 422 });
    logApiError("/api/quotations/calculate", error);
    return NextResponse.json(databaseErrorResponse(error, "The estimate is temporarily unavailable."), { status: 503 });
  }
}
