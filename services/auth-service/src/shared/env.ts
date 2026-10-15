/**
 * Environment config loader for `auth-service`. All configuration is read from
 * environment variables (STACK.md §4); see `.env.example` at the service root for the
 * documented list. Fails fast (throws) if a required variable is missing so
 * misconfiguration is caught at boot rather than surfacing as a runtime 500 later.
 */
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  // Account deletion (AICHAT-79) calls conversation-service with this shared secret. No default on
  // purpose: when either value is missing, DELETE /auth/me answers 503 and deletes nothing.
  INTERNAL_SERVICE_TOKEN: z.string().min(32).optional(),
  CONVERSATION_SERVICE_URL: z.string().url().optional(),
  // How often the retention job runs, in minutes; 0 turns it off.
  RETENTION_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(360),
  // Requests one client may send in 15 minutes; 0 turns the limit off (end-to-end runs).
  RATE_LIMIT_MAX: z.coerce.number().int().min(0).default(300),
  COOKIE_SECURE: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
  LOG_LEVEL: z.string().default("info"),
});

export type Env = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  /** Allowed CORS origin(s), comma-separated. */
  CORS_ORIGINS: string[];
  /** Shared secret for service-to-service calls; unset disables account deletion. */
  INTERNAL_SERVICE_TOKEN?: string;
  /** Base URL of conversation-service, for the erasure call. */
  CONVERSATION_SERVICE_URL?: string;
  /** Minutes between retention runs; 0 = off. */
  RETENTION_INTERVAL_MINUTES: number;
  /** Requests per client and 15 minutes; 0 = no limit. */
  RATE_LIMIT_MAX: number;
  COOKIE_SECURE: boolean;
  LOG_LEVEL: string;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.parse(source);
  return {
    NODE_ENV: parsed.NODE_ENV,
    PORT: parsed.PORT,
    DATABASE_URL: parsed.DATABASE_URL,
    JWT_SECRET: parsed.JWT_SECRET,
    CORS_ORIGINS: parsed.CORS_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    INTERNAL_SERVICE_TOKEN: parsed.INTERNAL_SERVICE_TOKEN,
    CONVERSATION_SERVICE_URL: parsed.CONVERSATION_SERVICE_URL,
    RETENTION_INTERVAL_MINUTES: parsed.RETENTION_INTERVAL_MINUTES,
    RATE_LIMIT_MAX: parsed.RATE_LIMIT_MAX,
    COOKIE_SECURE: parsed.COOKIE_SECURE,
    LOG_LEVEL: parsed.LOG_LEVEL,
  };
}

export const env: Env = loadEnv();
