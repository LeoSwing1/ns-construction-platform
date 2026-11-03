import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse, prismaErrorDetails } from "@/lib/prisma-errors";
const COOKIE = "ns_admin_session";
export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "SALES";
export type AdminIdentity = { email: string; role: AdminRole };

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(value);
}

export async function createSession(email: string, role: AdminRole = "SUPER_ADMIN", userId?: string) {
  const token = await new SignJWT({ email, role, ...(userId ? { userId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
}

export async function destroySession() {
  const jar = await cookies(); jar.delete(COOKIE);
}

async function readAdmin(): Promise<AdminIdentity | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret()));
  } catch {
    return null;
  }
  if (typeof payload.email !== "string") return null;
  if (payload.role === "admin") return { email: payload.email, role: "SUPER_ADMIN" };
  if (payload.role !== "SUPER_ADMIN" && payload.role !== "ADMIN" && payload.role !== "EDITOR" && payload.role !== "SALES") return null;
  if (typeof payload.userId === "string") {
    const user = await prisma.adminUser.findUnique({ where: { id: payload.userId }, select: { email: true, role: true, disabled: true } });
    if (!user || user.disabled || user.email !== payload.email || user.role !== payload.role) return null;
  }
  return { email: payload.email, role: payload.role };
}

export async function getAdmin(): Promise<AdminIdentity | null> {
  try {
    return await readAdmin();
  } catch (error) {
    console.error("Admin account authorization could not be verified", prismaErrorDetails(error));
    return null;
  }
}

export async function getAdminOrResponse(): Promise<
  { admin: AdminIdentity; response: null }
  | { admin: null; response: NextResponse }
> {
  try {
    const admin = await readAdmin();
    return admin
      ? { admin, response: null }
      : { admin: null, response: NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 }) };
  } catch (error) {
    console.error("Admin account authorization could not be verified", prismaErrorDetails(error));
    return {
      admin: null,
      response: NextResponse.json(databaseErrorResponse(error, "Admin access could not be verified."), { status: 503 }),
    };
  }
}

export function canManageContent(admin: AdminIdentity) {
  return admin.role === "SUPER_ADMIN" || admin.role === "ADMIN" || admin.role === "EDITOR";
}

export function canManageLeads(admin: AdminIdentity) {
  return admin.role === "SUPER_ADMIN" || admin.role === "ADMIN" || admin.role === "SALES";
}

export function canManageSettings(admin: AdminIdentity) {
  return admin.role === "SUPER_ADMIN" || admin.role === "ADMIN";
}
