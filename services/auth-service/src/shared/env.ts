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
    COOKIE_SECURE: parsed.COOKIE_SECURE,
    LOG_LEVEL: parsed.LOG_LEVEL,
  };
}

export const env: Env = loadEnv();
