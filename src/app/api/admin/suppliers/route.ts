import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminOrResponse, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const supplierSchema = z.object({ id: z.string().optional(), companyName: z.string().trim().min(2).max(180), contactPerson: z.string().max(140).nullable().optional(), phone: z.string().max(30).nullable().optional(), whatsapp: z.string().max(30).nullable().optional(), email: z.string().email().nullable().optional().or(z.literal("")), address: z.string().max(3000).nullable().optional(), gstNumber: z.string().max(30).nullable().optional(), categories: z.array(z.string().max(100)).max(40).default([]), brands: z.array(z.string().max(100)).max(80).default([]), paymentTerms: z.string().max(2000).nullable().optional(), deliveryTerms: z.string().max(2000).nullable().optional(), notes: z.string().max(5000).nullable().optional(), active: z.boolean().default(true) });
const createSupplierSchema = supplierSchema.omit({ id: true });

export async function GET() {
 const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 try { const data = await prisma.supplier.findMany({ include: { _count: { select: { products: true, quotations: true, rates: true } } }, orderBy: { companyName: "asc" } }); return NextResponse.json(data); }
 catch (error) { console.error("Suppliers GET failed", error); return NextResponse.json({ error: "Suppliers could not be loaded." }, { status: 503 }); }
}
export async function POST(request: Request) {
 const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
 const parsed = createSupplierSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid supplier details.", details: parsed.error.flatten() }, { status: 400 });
 const data = parsed.data;
 try { const item = await prisma.supplier.create({ data: { ...data, email: data.email || null } }); await prisma.activityLog.create({ data: { action: "SUPPLIER_CREATED", entityType: "SUPPLIER", entityId: item.id, actorEmail: auth.admin.email, details: item.companyName } }); return NextResponse.json(item, { status: 201 }); }
 catch (error) { console.error("Suppliers POST failed", error); return NextResponse.json({ error: "Supplier could not be saved." }, { status: 400 }); }
}
export async function PATCH(request: Request) {
 const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
 const parsed = supplierSchema.extend({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid supplier details.", details: parsed.error.flatten() }, { status: 400 });
 const { id, ...data } = parsed.data;
 try { const item = await prisma.supplier.update({ where: { id }, data: { ...data, email: data.email || null } }); await prisma.activityLog.create({ data: { action: "SUPPLIER_UPDATED", entityType: "SUPPLIER", entityId: item.id, actorEmail: auth.admin.email, details: item.companyName } }); return NextResponse.json(item); }
 catch (error) { console.error("Suppliers PATCH failed", error); return NextResponse.json({ error: "Supplier could not be updated." }, { status: 400 }); }
}
