import { DatabaseConfigurationError } from "@/lib/database-config";

function safeIdentifier(value: unknown) {
  if (typeof value !== "string") return undefined;
  const identifier = value.slice(0, 120);
  return /^[A-Za-z0-9_.$"-]+$/.test(identifier) ? identifier : undefined;
}

function errorMetadata(error: unknown) {
  if (typeof error !== "object" || error === null || !("meta" in error)) return null;
  const meta = error.meta;
  return typeof meta === "object" && meta !== null ? meta : null;
}

export function prismaErrorCode(error: unknown) {
  if (error instanceof DatabaseConfigurationError) return error.code;
  if (typeof error === "object" && error !== null) {
    if ("code" in error && typeof error.code === "string") return error.code;
    if ("errorCode" in error && typeof error.errorCode === "string") return error.errorCode;
    if ("message" in error && typeof error.message === "string" && /can't reach database server/i.test(error.message)) return "P1001";
  }
  return null;
}

export function prismaErrorDetails(error: unknown) {
  const meta = errorMetadata(error);
  const details = {
    code: prismaErrorCode(error) || "UNEXPECTED_ERROR",
    errorName: error instanceof Error ? error.name : "UnknownError",
    model: meta && "modelName" in meta ? safeIdentifier(meta.modelName) : undefined,
    table: meta && "table" in meta ? safeIdentifier(meta.table) : undefined,
    column: meta && "column" in meta ? safeIdentifier(meta.column) : undefined,
  };
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
}

export function databaseErrorMessage(error: unknown, fallback: string) {
  const code = prismaErrorCode(error);
  if (code === "DATABASE_CONFIG_INVALID" || code === "P1013") {
    return "Database configuration is invalid. The operator must set DATABASE_URL to a valid PostgreSQL connection string.";
  }
  if (code === "P1000" || code === "P1010") {
    return "Database authentication or access was rejected. Verify the database credentials and permissions privately.";
  }
  if (code === "P1003") {
    return "The configured PostgreSQL database name was not found. Verify DATABASE_URL privately.";
  }
  if (code === "P1011") {
    return "The secure connection to PostgreSQL could not be established. Verify the server TLS settings.";
  }
  if (code === "P1001" || code === "P1002" || code === "P1008" || code === "P1017") {
    return "The database is currently unreachable. Please try again later.";
  }
  if (code === "P2021") {
    return "A required database table is missing. Verify the applied Prisma migrations.";
  }
  if (code === "P2022") {
    return "A required database column is missing. Verify the applied Prisma migrations.";
  }
  if (code === "P2023") {
    return "The database contains data incompatible with the expected schema.";
  }
  return fallback;
}

export function databaseErrorResponse(error: unknown, fallback: string, fallbackCode = "SERVICE_UNAVAILABLE") {
  const prismaCode = prismaErrorCode(error);
  let code = fallbackCode;

  if (prismaCode === "DATABASE_CONFIG_INVALID" || prismaCode === "P1013") code = "DATABASE_CONFIG_INVALID";
  else if (prismaCode === "P1000" || prismaCode === "P1010") code = "DATABASE_AUTH_FAILED";
  else if (prismaCode === "P1003") code = "DATABASE_NOT_FOUND";
  else if (prismaCode === "P1011") code = "DATABASE_TLS_FAILED";
  else if (["P1001", "P1002", "P1008", "P1017"].includes(prismaCode || "")) code = "DATABASE_UNAVAILABLE";
  else if (prismaCode === "P2021" || prismaCode === "P2022") code = "DATABASE_SCHEMA_OUTDATED";
  else if (prismaCode === "P2023") code = "DATABASE_DATA_INCOMPATIBLE";

  return {
    code,
    error: databaseErrorMessage(error, fallback),
  };
}
