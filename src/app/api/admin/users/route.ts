import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";

const scryptAsync = promisify(scrypt);
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(["ADMIN", "EDITOR", "SALES"]),
});

export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (admin.role !== "SUPER_ADMIN" && admin.role !== "ADMIN") return NextResponse.json({ error: "Only administrators can view team accounts." }, { status: 403 });
  try {
    return NextResponse.json(await prisma.adminUser.findMany({
      select: { id: true, name: true, email: true, role: true, disabled: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }));
  } catch (error) {
    console.error("Team directory could not be loaded", { code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return NextResponse.json(databaseErrorResponse(error, "The team directory is temporarily unavailable."), { status: 503 });
  }
}

export async function POST(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (admin.role !== "SUPER_ADMIN" && admin.role !== "ADMIN") return NextResponse.json({ error: "Only administrators can create team accounts." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the name, email, password and role." }, { status: 400 });
  if (admin.role === "ADMIN" && parsed.data.role === "ADMIN") {
    return NextResponse.json({ error: "Only the owner can create administrator accounts." }, { status: 403 });
  }

  try {
    const salt = randomBytes(16).toString("hex");
    const derived = await scryptAsync(parsed.data.password, salt, 64) as Buffer;
    const created = await prisma.$transaction(async (transaction) => {
      const user = await transaction.adminUser.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          passwordHash: `scrypt$${salt}$${derived.toString("hex")}`,
          role: parsed.data.role,
        },
        select: { id: true, name: true, email: true, role: true, disabled: true, createdAt: true },
      });
      await transaction.activityLog.create({
        data: { action: "ADMIN_USER_CREATED", entityType: "ADMIN_USER", entityId: user.id, actorEmail: admin.email, details: `Created team account with role ${user.role}.` },
      });
      return user;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Team account creation failed", { code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return prismaErrorCode(error) === "P2002"
      ? NextResponse.json({ error: "An account with this email already exists.", code: "DUPLICATE_EMAIL" }, { status: 409 })
      : NextResponse.json(databaseErrorResponse(error, "Team account could not be created."), { status: 503 });
  }
}

const updateSchema = z.object({ id: z.string().min(1), role: z.enum(["ADMIN", "EDITOR", "SALES"]).optional(), disabled: z.boolean().optional() })
  .refine((value) => value.role !== undefined || value.disabled !== undefined);

export async function PATCH(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (admin.role !== "SUPER_ADMIN" && admin.role !== "ADMIN") return NextResponse.json({ error: "Only administrators can update team accounts." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid team account update." }, { status: 400 });
  if (admin.role === "ADMIN" && parsed.data.role === "ADMIN") return NextResponse.json({ error: "Only the owner can assign administrator access." }, { status: 403 });

  try {
    if (parsed.data.id === (await getAdminUserId(admin.email))) return NextResponse.json({ error: "You cannot disable or change your own account here." }, { status: 400 });
    const previous = await prisma.adminUser.findUnique({ where: { id: parsed.data.id }, select: { role: true } });
    if (!previous) return NextResponse.json({ error: "Team account not found." }, { status: 404 });
    if (admin.role === "ADMIN" && (previous.role === "ADMIN" || (parsed.data.disabled === true && previous.role === "SUPER_ADMIN"))) {
      return NextResponse.json({ error: "Only the owner can change or disable administrator accounts." }, { status: 403 });
    }
    const updated = await prisma.adminUser.update({
      where: { id: parsed.data.id },
      data: { ...(parsed.data.role ? { role: parsed.data.role } : {}), ...(parsed.data.disabled !== undefined ? { disabled: parsed.data.disabled } : {}) },
      select: { id: true, name: true, email: true, role: true, disabled: true, createdAt: true },
    });
    await prisma.activityLog.create({ data: { action: "ADMIN_USER_UPDATED", entityType: "ADMIN_USER", entityId: updated.id, actorEmail: admin.email, details: `Team account role/status updated (${updated.role}${updated.disabled ? ", disabled" : ""}).` } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Team account update failed", { code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return prismaErrorCode(error) === "P2025"
      ? NextResponse.json({ error: "Team account not found.", code: "RECORD_NOT_FOUND" }, { status: 404 })
      : NextResponse.json(databaseErrorResponse(error, "Team account could not be updated."), { status: 503 });
  }
}

async function getAdminUserId(email: string) {
  if (email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()) return null;
  const user = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}
