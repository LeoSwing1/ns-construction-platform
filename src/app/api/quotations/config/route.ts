import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-errors";
import { databaseErrorResponse } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [packages, categories] = await Promise.all([
      prisma.constructionPackage.findMany({
        where: { active: true },
        orderBy: { quality: "asc" },
        select: { id: true, code: true, name: true, description: true, quality: true, ratePerSqFt: true, validityDays: true, inclusions: true, exclusions: true },
      }),
      prisma.materialCategory.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          specifications: {
            where: { active: true },
            orderBy: [{ quality: "asc" }, { name: "asc" }],
            select: { id: true, name: true, quality: true, brand: true, details: true },
          },
        },
      }),
    ]);
    const requiredPackages = ["ESSENTIAL", "PREMIUM", "LUXURY"];
    const availableCodes = new Set(packages.map((item) => item.code));
    const missingPackages = requiredPackages.filter((code) => !availableCodes.has(code));
    if (missingPackages.length > 0) {
      return NextResponse.json({
        code: "QUOTATION_CONFIGURATION_INCOMPLETE",
        error: "Required quotation packages are missing or inactive. Verify the quotation migration and package configuration.",
      }, { status: 503 });
    }
    if (categories.length === 0) {
      return NextResponse.json({
        code: "QUOTATION_CONFIGURATION_INCOMPLETE",
        error: "The material catalogue is empty. Verify the quotation migration before using material-based estimates.",
      }, { status: 503 });
    }

    return NextResponse.json({
      packages: packages.map((item) => ({ ...item, ratePerSqFt: item.ratePerSqFt?.toString() ?? null })),
      categories,
    });
  } catch (error) {
    logApiError("/api/quotations/config", error);
    return NextResponse.json(databaseErrorResponse(error, "Quotation options are temporarily unavailable."), { status: 503 });
  }
}
