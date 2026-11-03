import { NextResponse } from "next/server";
import { z } from "zod";
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeLoginRateLimit } from "@/lib/rate-limit";
import { databaseErrorResponse, prismaErrorDetails } from "@/lib/prisma-errors";

const scryptAsync = promisify(scrypt);
const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

async function passwordMatches(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await scryptAsync(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  let stage = "rate-limit";
  try {
    if (!await consumeLoginRateLimit(req, 10)) {
      return NextResponse.json({ error: "Too many sign-in attempts. Please wait before trying again." }, { status: 429 });
    }

    if (email && password && parsed.data.email.toLowerCase() === email.toLowerCase() && parsed.data.password === password) {
      stage = "session-creation";
      await createSession(email, "SUPER_ADMIN");
      return NextResponse.json({ ok: true });
    }

    stage = "credential-lookup";
    const user = await prisma.adminUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || user.disabled || !await passwordMatches(parsed.data.password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    stage = "session-creation";
    await createSession(user.email, user.role, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const sessionConfigurationError = error instanceof Error && error.message.includes("ADMIN_SESSION_SECRET");
    console.error("Admin sign-in failed", {
      route: "POST /api/admin/login",
      stage,
      ...prismaErrorDetails(error),
    });
    if (sessionConfigurationError) {
      return NextResponse.json({
        code: "SESSION_CONFIGURATION_INVALID",
        error: "The sign-in session is not configured correctly. Contact the site operator.",
      }, { status: 503 });
    }
    if (stage === "session-creation") {
      return NextResponse.json({
        code: "SESSION_CREATION_FAILED",
        error: "A secure sign-in session could not be created. Please try again.",
      }, { status: 503 });
    }
    return NextResponse.json(databaseErrorResponse(error, "Sign-in is temporarily unavailable. Check the database and session configuration."), { status: 503 });
  }
}
