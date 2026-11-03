import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageSettings, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decimal } from "@/lib/quotations";
import { databaseErrorResponse } from "@/lib/prisma-errors";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), categoryId: z.string().min(1), name: z.string().trim().min(2).max(160), quality: z.enum(["ESSENTIAL", "PREMIUM", "LUXURY"]), brand: z.string().trim().max(120).nullable(), details: z.string().max(2000) }),
  z.object({ action: z.literal("update"), specificationId: z.string().min(1), name: z.string().trim().min(2).max(160), quality: z.enum(["ESSENTIAL", "PREMIUM", "LUXURY"]), brand: z.string().trim().max(120).nullable(), details: z.string().max(2000) }),
  z.object({ action: z.literal("pricing"), packageId: z.string().min(1), specificationId: z.string().min(1), adjustmentPerSqFt: z.number().finite().min(0).max(1_000_000) }),
  z.object({ action: z.literal("default"), packageId: z.string().min(1), categoryId: z.string().min(1), specificationId: z.string().min(1).nullable() }),
  z.object({ action: z.literal("toggle"), specificationId: z.string().min(1), active: z.boolean() }),
]);

export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  try {
    const [categories, packages] = await Promise.all([
      prisma.materialCategory.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          specifications: {
            orderBy: [{ quality: "asc" }, { name: "asc" }],
            include: { pricingRules: { select: { packageId: true, adjustmentPerSqFt: true } }, defaultFor: { select: { packageId: true } } },
          },
        },
      }),
      prisma.constructionPackage.findMany({ orderBy: { quality: "asc" }, select: { id: true, code: true, name: true, quality: true, ratePerSqFt: true } }),
    ]);
    return NextResponse.json({
      categories,
      packages: packages.map((item) => ({ ...item, ratePerSqFt: item.ratePerSqFt?.toString() ?? null })),
    });
  } catch (error) {
    logApiError("/api/admin/quotations/materials GET", error);
    return NextResponse.json(databaseErrorResponse(error, "Material catalogue is temporarily unavailable."), { status: 503 });
  }
}

export async function POST(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageSettings(admin)) return NextResponse.json({ error: "Only administrators can manage material pricing." }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid material catalogue update." }, { status: 400 });
  try {
    if (parsed.data.action === "create") {
      const specification = await prisma.materialSpecification.create({
        data: {
          categoryId: parsed.data.categoryId,
          name: parsed.data.name,
          quality: parsed.data.quality,
          brand: parsed.data.brand,
          details: parsed.data.details,
        },
      });
      await prisma.activityLog.create({ data: { action: "MATERIAL_SPECIFICATION_CREATED", entityType: "MATERIAL_SPECIFICATION", entityId: specification.id, actorEmail: admin.email, details: `${specification.name} was added to the configurable catalogue.` } });
      return NextResponse.json(specification, { status: 201 });
    }

    if (parsed.data.action === "update") {
      const specification = await prisma.materialSpecification.update({
        where: { id: parsed.data.specificationId },
        data: { name: parsed.data.name, quality: parsed.data.quality, brand: parsed.data.brand, details: parsed.data.details },
      });
      await prisma.activityLog.create({ data: { action: "MATERIAL_SPECIFICATION_UPDATED", entityType: "MATERIAL_SPECIFICATION", entityId: specification.id, actorEmail: admin.email, details: `Approved details for ${specification.name} updated.` } });
      return NextResponse.json(specification);
    }

    if (parsed.data.action === "pricing") {
      const { packageId, specificationId, adjustmentPerSqFt } = parsed.data;
      const item = await prisma.materialSpecification.findUnique({ where: { id: specificationId }, select: { id: true, name: true } });
      if (!item) return NextResponse.json({ error: "Material specification not found." }, { status: 404 });
      const rule = await prisma.pricingRule.upsert({
        where: { packageId_specificationId: { packageId, specificationId } },
        create: { packageId, specificationId, adjustmentPerSqFt: decimal(adjustmentPerSqFt) },
        update: { adjustmentPerSqFt: decimal(adjustmentPerSqFt) },
      });
      await prisma.activityLog.create({ data: { action: "MATERIAL_PRICING_UPDATED", entityType: "PRICING_RULE", entityId: rule.id, actorEmail: admin.email, details: `Pricing adjustment for ${item.name} updated.` } });
      return NextResponse.json({ ...rule, adjustmentPerSqFt: rule.adjustmentPerSqFt.toString() });
    }

    if (parsed.data.action === "default") {
      const { packageId, categoryId, specificationId } = parsed.data;
      if (!specificationId) {
        await prisma.packageMaterial.deleteMany({ where: { packageId, categoryId } });
        return NextResponse.json({ ok: true });
      }
      if (specificationId) {
        const specification = await prisma.materialSpecification.findUnique({ where: { id: specificationId }, select: { categoryId: true, active: true } });
        if (!specification || !specification.active || specification.categoryId !== categoryId) {
          return NextResponse.json({ error: "Choose an active specification from this material category." }, { status: 400 });
        }
      }
      const item = await prisma.packageMaterial.upsert({
        where: { packageId_categoryId: { packageId, categoryId } },
        create: { packageId, categoryId, specificationId },
        update: { specificationId },
      });
      await prisma.activityLog.create({ data: { action: "PACKAGE_MATERIAL_UPDATED", entityType: "CONSTRUCTION_PACKAGE", entityId: packageId, actorEmail: admin.email, details: "Included material specification updated." } });
      return NextResponse.json(item);
    }

    const updated = await prisma.materialSpecification.update({ where: { id: parsed.data.specificationId }, data: { active: parsed.data.active } });
    await prisma.activityLog.create({ data: { action: "MATERIAL_SPECIFICATION_TOGGLED", entityType: "MATERIAL_SPECIFICATION", entityId: updated.id, actorEmail: admin.email, details: `Material specification ${updated.active ? "activated" : "deactivated"}.` } });
    return NextResponse.json(updated);
  } catch (error) {
    logApiError("/api/admin/quotations/materials POST", error);
    return NextResponse.json(databaseErrorResponse(error, "Material catalogue update could not be saved."), { status: 503 });
  }
}
