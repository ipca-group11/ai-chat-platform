import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4002),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/conversation?schema=public"),
  // No default on purpose (H2): the service refuses to start without a signing secret.
  JWT_SECRET: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  // Base URLs of the LLM providers. Tests and the mock server point them elsewhere (AICHAT-43).
  ANTHROPIC_BASE_URL: z.string().url().default("https://api.anthropic.com"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com"),
  // Local Ollama server (no API key).
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  // Optional system prompt added at the start of every conversation. Unset in production (no system prompt today);
  // the red-team test stack sets it to a prompt that holds a canary (AICHAT-26, compose.redteam.yaml).
  SYSTEM_PROMPT: z.string().min(1).optional(),
  // Shared secret of the service-to-service calls (account erasure, AICHAT-79). No default on purpose:
  // without it the internal routes are not mounted at all.
  INTERNAL_SERVICE_TOKEN: z.string().min(32).optional(),
  // How often the retention job runs, in minutes; 0 turns it off.
  RETENTION_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(360),
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

/** Parses only the LLM provider base URLs; the provider registry needs no secrets. */
export function parseProviderEnv(source: NodeJS.ProcessEnv): Pick<Env, "ANTHROPIC_BASE_URL" | "OPENAI_BASE_URL" | "OLLAMA_BASE_URL"> {
  return envSchema.pick({ ANTHROPIC_BASE_URL: true, OPENAI_BASE_URL: true, OLLAMA_BASE_URL: true }).parse(source);
}
