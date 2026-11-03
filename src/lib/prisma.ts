import { PrismaClient } from "@prisma/client";
import { validateDatabaseUrl } from "@/lib/database-config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient() {
  validateDatabaseUrl();
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
