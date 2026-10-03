import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4002),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/conversation?schema=public"),
  JWT_SECRET: z.string().min(1).default("change-me-in-every-environment"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  LOG_LEVEL: z.string().default("info"),
});

export type Env = z.infer<typeof envSchema>;

/** Parses `process.env` once and memoizes the result; throws on startup if invalid. */
let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (!cached) {
    cached = envSchema.parse(source);
  }
  return cached;
}

/** Test-only helper to bypass memoization. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}
