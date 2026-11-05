import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAdminOrResponse, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  id: z.string().optional(), name: z.string().trim().min(2).max(160), slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().trim().min(2).max(100), description: z.string().max(12000).default(""), brand: z.string().max(120).nullable().optional(),
  grade: z.string().max(80).nullable().optional(), model: z.string().max(120).nullable().optional(), dimensions: z.string().max(200).nullable().optional(),
  specifications: z.record(z.unknown()).default({}), unit: z.string().min(1).max(40), sellingPrice: z.number().finite().nonnegative().nullable().optional(),
  wholesalePrice: z.number().finite().nonnegative().nullable().optional(), stockQuantity: z.number().finite().nonnegative().nullable().optional(),
  stockStatus: z.enum(["IN_STOCK", "LIMITED", "OUT_OF_STOCK", "ENQUIRY_ONLY"]).default("ENQUIRY_ONLY"), supplierId: z.string().nullable().optional(),
  images: z.array(z.string().url()).max(12).default([]), featured: z.boolean().default(false), active: z.boolean().default(false),
});
const createSchema = schema.omit({ id: true });

export async function GET() {
  const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const items = await prisma.product.findMany({ include: { supplier: { select: { id: true, companyName: true } } }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json(items.map(p => ({ ...p, sellingPrice: p.sellingPrice?.toString() ?? null, wholesalePrice: p.wholesalePrice?.toString() ?? null, stockQuantity: p.stockQuantity?.toString() ?? null })));
  } catch (error) { console.error("Admin materials GET failed", error); return NextResponse.json({ error: "Products could not be loaded." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid product details.", details: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  try {
    const item = await prisma.product.create({ data: { ...data, specifications: data.specifications as Prisma.InputJsonValue, sellingPrice: data.sellingPrice ?? null, wholesalePrice: data.wholesalePrice ?? null, stockQuantity: data.stockQuantity ?? null } });
    await prisma.activityLog.create({ data: { action: "PRODUCT_CREATED", entityType: "PRODUCT", entityId: item.id, actorEmail: auth.admin.email, details: item.name } });
    return NextResponse.json(item, { status: 201 });
  } catch (error) { console.error("Admin materials POST failed", error); return NextResponse.json({ error: "Product could not be saved. Check that its slug is unique and supplier exists." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const parsed = schema.extend({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid product details.", details: parsed.error.flatten() }, { status: 400 });
  const { id, ...data } = parsed.data;
  try {
    const item = await prisma.product.update({ where: { id }, data: { ...data, specifications: data.specifications as Prisma.InputJsonValue, sellingPrice: data.sellingPrice ?? null, wholesalePrice: data.wholesalePrice ?? null, stockQuantity: data.stockQuantity ?? null } });
    await prisma.activityLog.create({ data: { action: "PRODUCT_UPDATED", entityType: "PRODUCT", entityId: item.id, actorEmail: auth.admin.email, details: item.name } });
    return NextResponse.json(item);
  } catch (error) { console.error("Admin materials PATCH failed", error); return NextResponse.json({ error: "Product could not be updated." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
  try { const item = await prisma.product.update({ where: { id }, data: { active: false, featured: false } }); return NextResponse.json({ success: true, id: item.id }); }
  catch (error) { console.error("Admin materials DELETE failed", error); return NextResponse.json({ error: "Product could not be archived." }, { status: 400 }); }
}
