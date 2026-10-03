import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4010),
  /** Fixed delay added to every mock response. */
  LATENCY_MS: z.coerce.number().int().min(0).default(0),
  /** LLM mocks: time to first token. */
  TTFT_MS: z.coerce.number().int().min(0).default(200),
  /** LLM mocks: gap between two tokens. */
  TOKEN_INTERVAL_MS: z.coerce.number().int().min(0).default(20),
  /** LLM mocks: tokens in a default answer. */
  TOKENS: z.coerce.number().int().positive().default(40),
  /** Share of mock requests (0 to 1) that fail with a 500 at random. */
  ERROR_RATE: z.coerce.number().min(0).max(1).default(0),
  /** Seed of the pseudo-random generator; a number, or any text (hashed). */
  SEED: z.string().min(1).default("1"),
  /** Dataset loaded at start-up and after a reset. */
  MOCK_DATASET: z.string().min(1).default("empty"),
  /** LLM replay: folder with `anthropic/*.sse` and `openai/*.sse`. Default: the AICHAT-25 fixtures in the repo. */
  FIXTURES_DIR: z.string().min(1).optional(),
});

export interface MockConfig {
  port: number;
  latencyMs: number;
  ttftMs: number;
  tokenIntervalMs: number;
  tokens: number;
  errorRate: number;
  seed: string;
  dataset: string;
  /** Set by FIXTURES_DIR; when undefined the replay looks for the repo's fixtures. */
  fixturesDir: string | undefined;
}

/** Reads the mock server settings from the environment; throws when a value is invalid. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): MockConfig {
  const env = envSchema.parse(source);
  return {
    port: env.PORT,
    latencyMs: env.LATENCY_MS,
    ttftMs: env.TTFT_MS,
    tokenIntervalMs: env.TOKEN_INTERVAL_MS,
    tokens: env.TOKENS,
    errorRate: env.ERROR_RATE,
    seed: env.SEED,
    dataset: env.MOCK_DATASET,
    fixturesDir: env.FIXTURES_DIR,
  };
}
