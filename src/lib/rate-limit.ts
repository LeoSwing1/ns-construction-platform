import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { prismaErrorCode } from "@/lib/prisma-errors";

const WINDOW_MS = 60 * 60 * 1000;
const localBuckets = new Map<string, { hits: number; expiresAt: number }>();

export async function consumeRateLimit(request: Request, scope: string, maximum: number) {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be configured before rate limiting can run.");
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  const key = createHmac("sha256", sessionSecret).update(`${scope}:${address}`).digest("hex");
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart },
    update: { hits: { increment: 1 } },
    select: { hits: true },
  });

  if (bucket.hits === 1) {
    await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - WINDOW_MS * 24) } } });
  }
  return bucket.hits <= maximum;
}

export async function consumeLoginRateLimit(request: Request, maximum: number) {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be configured before rate limiting can run.");
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  const key = createHmac("sha256", sessionSecret).update(`admin-login:${address}`).digest("hex");
  const now = Date.now();
  const current = localBuckets.get(key);
  const local = !current || current.expiresAt <= now
    ? { hits: 1, expiresAt: now + WINDOW_MS }
    : { hits: current.hits + 1, expiresAt: current.expiresAt };
  localBuckets.set(key, local);
  if (local.hits > maximum) return false;

  try {
    return await consumeRateLimit(request, "admin-login", maximum);
  } catch (error) {
    const code = prismaErrorCode(error);
    if (!["DATABASE_CONFIG_INVALID", "P1000", "P1001", "P1002", "P1003", "P1008", "P1010", "P1011", "P1013", "P1017", "P2021", "P2022"].includes(code || "")) throw error;
    console.error("Persistent login rate limiting is unavailable; using the per-process limit", { code });
    return true;
  }
}
