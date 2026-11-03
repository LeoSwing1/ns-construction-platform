export class DatabaseConfigurationError extends Error {
  readonly code = "DATABASE_CONFIG_INVALID";

  constructor() {
    super("DATABASE_URL is missing or contains a placeholder PostgreSQL host.");
    this.name = "DatabaseConfigurationError";
  }
}

const placeholderHosts = new Set([
  "host",
  "hostname",
  "your-host",
  "your-db-host",
  "your-database-host",
  "example.com",
  "example.org",
  "example.net",
]);

export function validateDatabaseUrl(value = process.env.DATABASE_URL) {
  if (!value?.trim()) throw new DatabaseConfigurationError();

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DatabaseConfigurationError();
  }

  const hostname = url.hostname.toLowerCase();
  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
    || !hostname
    || placeholderHosts.has(hostname)
    || hostname.startsWith("your-")
    || hostname.includes("<")
    || hostname.includes(">")
  ) {
    throw new DatabaseConfigurationError();
  }

  return value;
}
