import { z } from "zod";
import { parseDomainList } from "../features/llm-adapters/web-fetch-domains.js";

/** A comma-separated domain list (AICHAT-242); an invalid entry fails at startup. */
const domainList = z
  .string()
  .optional()
  .transform((value, ctx) => {
    try {
      return parseDomainList(value);
    } catch (err) {
      ctx.addIssue({ code: "custom", message: (err as Error).message });
      return z.NEVER;
    }
  });

const envFields = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4002),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/conversation?schema=public"),
  // Required, with no default: a missing secret must stop the service at boot instead of letting it
  // accept tokens signed with a publicly known value (AICHAT-210). Compose, scripts/dev.sh and the test
  // setup files pass one explicitly.
  JWT_SECRET: z.string({ error: "JWT_SECRET is required" }).min(1, "JWT_SECRET is required"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  // Base URLs of the LLM providers. Tests and the mock server point them elsewhere (AICHAT-43).
  ANTHROPIC_BASE_URL: z.string().url().default("https://api.anthropic.com"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com"),
  // Local Ollama server (no API key).
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  // Opening of the system prompt of every reply (AICHAT-243). Unset or empty: the built-in one
  // (src/shared/system-prompt.ts). The rules about untrusted content are always appended to it. The red-team
  // stack sets a prompt that holds a canary (AICHAT-26, compose.redteam.yaml).
  SYSTEM_PROMPT: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().optional()),
  // Sites the model may fetch while answering (AICHAT-242), comma-separated, subdomains included:
  // only these (ALLOWED) or all but these (BLOCKED), never both. Unset: no restriction.
  WEB_FETCH_ALLOWED_DOMAINS: domainList,
  WEB_FETCH_BLOCKED_DOMAINS: domainList,
  // Shared secret of the service-to-service calls (account erasure, AICHAT-79). No default on purpose:
  // without it the internal routes are not mounted at all.
  INTERNAL_SERVICE_TOKEN: z.string().min(32).optional(),
  // How often the retention job runs, in minutes; 0 turns it off.
  RETENTION_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(360),
  LOG_LEVEL: z.string().default("info"),
});

const oneDomainList = {
  check: (env: { WEB_FETCH_ALLOWED_DOMAINS?: string[]; WEB_FETCH_BLOCKED_DOMAINS?: string[] }) =>
    !(env.WEB_FETCH_ALLOWED_DOMAINS && env.WEB_FETCH_BLOCKED_DOMAINS),
  params: { message: "Set WEB_FETCH_ALLOWED_DOMAINS or WEB_FETCH_BLOCKED_DOMAINS, not both", path: ["WEB_FETCH_BLOCKED_DOMAINS"] },
};

const envSchema = envFields.refine(oneDomainList.check, oneDomainList.params);

export type Env = z.infer<typeof envSchema>;

/** Parses `process.env` once and memoizes the result; throws on startup if invalid. */
let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (!cached) {
    cached = envSchema.parse(source);
  }
  return cached;
}

// Picked from the fields, not envSchema: zod refuses .pick() on a refined object.
const providerEnvSchema = envFields
  .pick({
    ANTHROPIC_BASE_URL: true,
    OPENAI_BASE_URL: true,
    OLLAMA_BASE_URL: true,
    WEB_FETCH_ALLOWED_DOMAINS: true,
    WEB_FETCH_BLOCKED_DOMAINS: true,
  })
  .refine(oneDomainList.check, oneDomainList.params);

/** Only the LLM provider settings (base URLs, web fetch domains), for code that needs nothing else (the adapter registry). */
export function parseProviderEnv(source: NodeJS.ProcessEnv): z.infer<typeof providerEnvSchema> {
  return providerEnvSchema.parse(source);
}

/** Test-only helper to bypass memoization. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}
