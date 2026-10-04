import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses the documented defaults", () => {
    expect(loadConfig({})).toEqual({
      port: 4010,
      latencyMs: 0,
      ttftMs: 200,
      tokenIntervalMs: 20,
      tokens: 40,
      errorRate: 0,
      seed: "1",
      dataset: "empty",
    });
  });

  it("reads LATENCY_MS, TTFT_MS, TOKEN_INTERVAL_MS, TOKENS, ERROR_RATE, SEED, MOCK_DATASET and PORT", () => {
    const config = loadConfig({
      PORT: "5000",
      LATENCY_MS: "15",
      TTFT_MS: "1",
      TOKEN_INTERVAL_MS: "2",
      TOKENS: "7",
      ERROR_RATE: "0.25",
      SEED: "abc",
      MOCK_DATASET: "default",
    });
    expect(config).toEqual({
      port: 5000,
      latencyMs: 15,
      ttftMs: 1,
      tokenIntervalMs: 2,
      tokens: 7,
      errorRate: 0.25,
      seed: "abc",
      dataset: "default",
    });
  });

  it("rejects values out of range", () => {
    expect(() => loadConfig({ ERROR_RATE: "2" })).toThrow();
    expect(() => loadConfig({ LATENCY_MS: "-1" })).toThrow();
    expect(() => loadConfig({ TOKENS: "0" })).toThrow();
  });
});
