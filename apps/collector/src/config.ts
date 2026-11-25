import { z } from "zod";

const Config = z.object({
  DATABASE_URL: z.url(),
  COLLECTOR_HOST: z.string().min(1).default("127.0.0.1"),
  COLLECTOR_PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  COLLECTOR_MAX_BODY_BYTES: z.coerce.number().int().positive().default(262144),
  COLLECTOR_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  COLLECTOR_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type CollectorConfig = {
  readonly databaseUrl: string;
  readonly host: string;
  readonly port: number;
  readonly maxBodyBytes: number;
  readonly trustedProxyHops: number;
  readonly shutdownTimeoutMs: number;
  readonly logLevel: "debug" | "info" | "warn" | "error";
};

/**
 * Reads and validates the environment once at startup (NODE-10). Only the entry point passes
 * `process.env`. The error names the invalid keys, never their values: `DATABASE_URL` holds
 * a password (NODE-11).
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): CollectorConfig {
  const parsed = Config.safeParse(env);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid collector configuration: ${keys.join(", ")}`);
  }
  const c = parsed.data;
  return {
    databaseUrl: c.DATABASE_URL,
    host: c.COLLECTOR_HOST,
    port: c.COLLECTOR_PORT,
    maxBodyBytes: c.COLLECTOR_MAX_BODY_BYTES,
    trustedProxyHops: c.COLLECTOR_TRUSTED_PROXY_HOPS,
    shutdownTimeoutMs: c.COLLECTOR_SHUTDOWN_TIMEOUT_MS,
    logLevel: c.LOG_LEVEL,
  };
}
