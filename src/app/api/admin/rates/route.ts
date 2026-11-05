import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminOrResponse, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const rateSchema = z.object({ materialName: z.string().trim().min(2).max(180), category: z.string().trim().min(2).max(100), brand: z.string().max(120).nullable().optional(), specification: z.string().max(1000).nullable().optional(), unit: z.string().trim().min(1).max(40), rate: z.number().finite().positive().max(100000000), location: z.string().trim().min(2).max(180).default("Lucknow, Uttar Pradesh"), sourceLabel: z.string().max(180).nullable().optional(), supplierId: z.string().nullable().optional(), effectiveFrom: z.string().datetime().optional(), expiresAt: z.string().datetime().nullable().optional(), notes: z.string().max(3000).nullable().optional() });
export async function GET() {
 const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 try { const rows = await prisma.materialRate.findMany({ include: { supplier: { select: { id: true, companyName: true } } }, orderBy: { createdAt: "desc" }, take: 500 }); return NextResponse.json(rows.map(r => ({ ...r, rate: r.rate.toString() }))); }
 catch (error) { console.error("Rates GET failed", error); return NextResponse.json({ error: "Material rates could not be loaded." }, { status: 503 }); }
}
export async function POST(request: Request) {
 const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
 const parsed = rateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid material rate.", details: parsed.error.flatten() }, { status: 400 });
 const d = parsed.data;
 try { const row = await prisma.materialRate.create({ data: { ...d, effectiveFrom: d.effectiveFrom ? new Date(d.effectiveFrom) : new Date(), expiresAt: d.expiresAt ? new Date(d.expiresAt) : null, status: "PENDING" } }); await prisma.activityLog.create({ data: { action: "MATERIAL_RATE_SUBMITTED", entityType: "MATERIAL_RATE", entityId: row.id, actorEmail: auth.admin.email, details: `${row.materialName}: ${row.rate} / ${row.unit}` } }); return NextResponse.json({ ...row, rate: row.rate.toString() }, { status: 201 }); }
 catch (error) { console.error("Rates POST failed", error); return NextResponse.json({ error: "Rate could not be submitted. Verify the supplier reference." }, { status: 400 }); }
}
export async function PATCH(request: Request) {
 const auth = await getAdminOrResponse(); if (auth.response) return auth.response; if (!auth.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Only administrators can approve material rates." }, { status: 403 });
 const body = z.object({ id: z.string().min(1), status: z.enum(["APPROVED", "REJECTED", "EXPIRED", "PENDING"]) }).safeParse(await request.json().catch(() => null));
 if (!body.success) return NextResponse.json({ error: "A valid rate ID and approval status are required." }, { status: 400 });
 try { const row = await prisma.materialRate.update({ where: { id: body.data.id }, data: { status: body.data.status, approvedBy: body.data.status === "APPROVED" ? auth.admin.email : null, approvedAt: body.data.status === "APPROVED" ? new Date() : null } }); await prisma.activityLog.create({ data: { action: `MATERIAL_RATE_${body.data.status}`, entityType: "MATERIAL_RATE", entityId: row.id, actorEmail: auth.admin.email, details: row.materialName } }); return NextResponse.json({ ...row, rate: row.rate.toString() }); }
 catch (error) { console.error("Rates PATCH failed", error); return NextResponse.json({ error: "Rate approval could not be updated." }, { status: 400 }); }
}
