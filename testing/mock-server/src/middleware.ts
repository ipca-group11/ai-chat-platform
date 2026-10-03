import type { RequestHandler } from "express";
import type { MockConfig } from "./config.js";
import type { Rng } from "./prng.js";

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** LATENCY_MS: waits before every mock response. */
export function latency(config: MockConfig): RequestHandler {
  return async (_req, _res, next) => {
    if (config.latencyMs > 0) await sleep(config.latencyMs);
    next();
  };
}

/** ERROR_RATE: fails that share of requests with a 500, chosen by the seeded generator. */
export function randomErrors(config: MockConfig, rng: Rng): RequestHandler {
  return (_req, res, next) => {
    if (config.errorRate > 0 && rng.chance(config.errorRate)) {
      res.status(500).json({ error: { code: "mock_random_error", message: "Random error injected by ERROR_RATE" } });
      return;
    }
    next();
  };
}
