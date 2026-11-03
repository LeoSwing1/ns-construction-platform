import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const chargeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  type: z.enum(["FIXED", "PERCENT"]),
  amount: z.number().finite().min(0).max(1_000_000),
});

const milestoneSchema = z.object({
  label: z.string().trim().min(2).max(100),
  percentage: z.number().finite().gt(0).lte(100),
});

const selectedSpecificationSchema = z.object({
  categoryId: z.string().min(1),
  specificationId: z.string().min(1),
});

export const estimateInputSchema = z.object({
  packageId: z.string().min(1),
  constructionAreaSqFt: z.number().finite().positive().max(1_000_000),
  selections: z.array(selectedSpecificationSchema).max(100),
});

export const quotationSubmissionSchema = estimateInputSchema.extend({
  submissionId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(24).regex(/^[+\d\s().-]+$/),
  email: z.union([z.string().trim().email().max(254), z.literal("")]),
  siteLocation: z.string().trim().min(2).max(240),
  propertyType: z.string().trim().min(2).max(100),
  plotAreaSqFt: z.number().finite().positive().max(1_000_000).nullable(),
  floors: z.number().int().min(1).max(100).nullable(),
  requirements: z.string().trim().max(5000),
  confirmUpgrades: z.boolean(),
});

export type EstimateInput = z.infer<typeof estimateInputSchema>;
export type CalculatedItem = {
  specificationId: string;
  categoryId: string;
  categoryName: string;
  specificationName: string;
  quality: "ESSENTIAL" | "PREMIUM" | "LUXURY";
  brand: string | null;
  details: string;
  adjustmentPerSqFt: number;
  includedInPackage: boolean;
  abovePackageGrade: boolean;
};

export class QuotationInputError extends Error {}

export class QuotationNotFoundError extends Error {}

const gradeRank = { ESSENTIAL: 0, PREMIUM: 1, LUXURY: 2 } as const;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const asNumber = (value: Prisma.Decimal | null) => value === null ? null : Number(value.toString());

function parsePackageJson<T extends z.ZodTypeAny>(value: Prisma.JsonValue, schema: T): z.infer<T>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = schema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

async function calculateForPackage(packageId: string, area: number, selections: EstimateInput["selections"]) {
  const packageDetails = await prisma.constructionPackage.findUnique({
    where: { id: packageId },
    include: { packageMaterials: true },
  });
  if (!packageDetails || !packageDetails.active) throw new QuotationInputError("The selected construction package is unavailable.");
  if (packageDetails.ratePerSqFt === null) throw new QuotationInputError(`${packageDetails.name} does not have an administrator-approved rate yet.`);

  const duplicateCategories = new Set<string>();
  for (const selection of selections) {
    if (duplicateCategories.has(selection.categoryId)) throw new QuotationInputError("Choose no more than one specification per material category.");
    duplicateCategories.add(selection.categoryId);
  }

  const selectedIds = selections.map((item) => item.specificationId);
  const specifications = selectedIds.length
    ? await prisma.materialSpecification.findMany({
      where: { id: { in: selectedIds }, active: true, category: { active: true } },
      include: { category: true },
    })
    : [];
  if (specifications.length !== selectedIds.length) throw new QuotationInputError("One or more selected material specifications are unavailable.");

  const specById = new Map(specifications.map((specification) => [specification.id, specification]));
  for (const selection of selections) {
    if (specById.get(selection.specificationId)?.categoryId !== selection.categoryId) {
      throw new QuotationInputError("A material specification does not match its selected category.");
    }
  }

  const [packageDefaults, rules] = await Promise.all([
    prisma.packageMaterial.findMany({ where: { packageId }, select: { categoryId: true, specificationId: true } }),
    selectedIds.length
      ? prisma.pricingRule.findMany({ where: { packageId, specificationId: { in: selectedIds } } })
      : Promise.resolve([]),
  ]);
  const defaults = new Map(packageDefaults.map((item) => [item.categoryId, item.specificationId]));
  const ruleBySpec = new Map(rules.map((rule) => [rule.specificationId, Number(rule.adjustmentPerSqFt.toString())]));

  const items: CalculatedItem[] = selections.map((selection) => {
    const specification = specById.get(selection.specificationId)!;
    const includedInPackage = defaults.get(selection.categoryId) === selection.specificationId;
    const adjustmentPerSqFt = includedInPackage ? 0 : ruleBySpec.get(selection.specificationId);
    if (adjustmentPerSqFt === undefined) {
      throw new QuotationInputError(`Pricing is not configured for ${specification.name} in ${packageDetails.name}. Ask the team to configure this specification or choose an included option.`);
    }
    return {
      specificationId: specification.id,
      categoryId: specification.categoryId,
      categoryName: specification.category.name,
      specificationName: specification.name,
      quality: specification.quality,
      brand: specification.brand,
      details: specification.details,
      adjustmentPerSqFt,
      includedInPackage,
      abovePackageGrade: gradeRank[specification.quality] > gradeRank[packageDetails.quality],
    };
  });

  const baseRatePerSqFt = Number(packageDetails.ratePerSqFt.toString());
  const upgradeRatePerSqFt = roundMoney(items.reduce((sum, item) => sum + item.adjustmentPerSqFt, 0));
  const applicableRatePerSqFt = roundMoney(baseRatePerSqFt + upgradeRatePerSqFt);
  const subtotal = roundMoney(applicableRatePerSqFt * area);
  const configuredCharges = parsePackageJson(packageDetails.additionalCharges, chargeSchema);
  const additionalCharges = configuredCharges.map((charge) => ({
    ...charge,
    total: roundMoney(charge.type === "FIXED" ? charge.amount : subtotal * charge.amount / 100),
  }));
  const additionalChargesTotal = roundMoney(additionalCharges.reduce((sum, charge) => sum + charge.total, 0));
  const gstRate = asNumber(packageDetails.gstRate);
  const gstAmount = gstRate === null ? 0 : roundMoney((subtotal + additionalChargesTotal) * gstRate / 100);
  const totalAmount = roundMoney(subtotal + additionalChargesTotal + gstAmount);

  return {
    packageId: packageDetails.id,
    packageCode: packageDetails.code,
    packageName: packageDetails.name,
    quality: packageDetails.quality,
    baseRatePerSqFt,
    upgradeRatePerSqFt,
    applicableRatePerSqFt,
    areaSqFt: area,
    subtotal,
    additionalCharges,
    additionalChargesTotal,
    gstRate,
    gstAmount,
    totalAmount,
    validityDays: packageDetails.validityDays,
    inclusions: packageDetails.inclusions,
    exclusions: packageDetails.exclusions,
    paymentMilestones: parsePackageJson(packageDetails.paymentMilestones, milestoneSchema),
    items,
  };
}

export async function calculateEstimate(input: EstimateInput) {
  const estimate = await calculateForPackage(input.packageId, input.constructionAreaSqFt, input.selections);
  const selectedRank = Math.max(gradeRank[estimate.quality], ...estimate.items.map((item) => gradeRank[item.quality]));
  const candidates = await prisma.constructionPackage.findMany({
    where: { active: true, quality: { in: Object.keys(gradeRank) as ("ESSENTIAL" | "PREMIUM" | "LUXURY")[] } },
    orderBy: { quality: "asc" },
    select: { id: true, name: true, quality: true, ratePerSqFt: true },
  });

  const recommended = candidates.find((candidate) => gradeRank[candidate.quality] >= selectedRank);
  let recommendedEstimate: Awaited<ReturnType<typeof calculateForPackage>> | null = null;
  if (recommended?.ratePerSqFt !== null && recommended) {
    try {
      recommendedEstimate = recommended.id === input.packageId
        ? estimate
        : await calculateForPackage(recommended.id, input.constructionAreaSqFt, input.selections);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
  }

  return {
    ...estimate,
    recommendedPackage: recommended ? {
      id: recommended.id,
      name: recommended.name,
      quality: recommended.quality,
      ratePerSqFt: asNumber(recommended.ratePerSqFt),
      totalAmount: recommendedEstimate?.totalAmount ?? null,
      applicableRatePerSqFt: recommendedEstimate?.applicableRatePerSqFt ?? null,
      unavailableReason: recommendedEstimate ? null : recommended.ratePerSqFt === null
        ? "The administrator has not configured this package rate."
        : "Configure the package inclusions and item pricing before using this recommendation.",
    } : null,
    rateDifference: recommendedEstimate && recommended && recommended.id !== input.packageId
      ? roundMoney(recommendedEstimate.totalAmount - estimate.totalAmount)
      : 0,
  };
}

export function newQuotationNumber() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `NSC-${stamp}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export function packageChargesSchema(value: unknown) {
  return z.array(chargeSchema).max(30).safeParse(value);
}

export function paymentMilestonesSchema(value: unknown) {
  const parsed = z.array(milestoneSchema).max(20).safeParse(value);
  if (!parsed.success) return parsed;
  const total = parsed.data.reduce((sum, milestone) => sum + milestone.percentage, 0);
  return total > 100.001
    ? { success: false as const, error: new Error("Payment milestone percentages must not exceed 100%.") }
    : parsed;
}
