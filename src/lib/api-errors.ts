import { prismaErrorCode } from "@/lib/prisma-errors";

export function logApiError(route: string, error: unknown) {
  console.error("API request failed", {
    route,
    code: prismaErrorCode(error) || "UNEXPECTED_ERROR",
  });
}
