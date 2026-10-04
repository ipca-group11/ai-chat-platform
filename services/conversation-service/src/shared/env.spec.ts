import { describe, expect, it } from "vitest";
import { loadEnv, parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("AC-45: applies safe defaults when optional variables are absent", () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(4002);
    expect(env.UPLOAD_DIR).toBe("./data/uploads");
    expect(env.MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it("AC-45: reads JWT_SECRET from the environment so it matches auth-service's signing secret", () => {
    const env = parseEnv({ JWT_SECRET: "shared-secret" });
    expect(env.JWT_SECRET).toBe("shared-secret");
  });

  it("AC-68: coerces MAX_UPLOAD_BYTES from a string env var to a number", () => {
    const env = parseEnv({ MAX_UPLOAD_BYTES: "1048576" });
    expect(env.MAX_UPLOAD_BYTES).toBe(1048576);
  });

  it("has no system prompt unless SYSTEM_PROMPT is set (AICHAT-26)", () => {
    expect(parseEnv({}).SYSTEM_PROMPT).toBeUndefined();
    expect(parseEnv({ SYSTEM_PROMPT: "Be brief." }).SYSTEM_PROMPT).toBe("Be brief.");
    expect(() => parseEnv({ SYSTEM_PROMPT: "" })).toThrow();
  });

  it("has no internal service token unless INTERNAL_SERVICE_TOKEN is set, and rejects a short one (AICHAT-79)", () => {
    expect(parseEnv({}).INTERNAL_SERVICE_TOKEN).toBeUndefined();
    expect(parseEnv({ INTERNAL_SERVICE_TOKEN: "x".repeat(32) }).INTERNAL_SERVICE_TOKEN).toBe("x".repeat(32));
    expect(() => parseEnv({ INTERNAL_SERVICE_TOKEN: "too-short" })).toThrow();
  });

  it("runs the retention job every 6 hours by default, and 0 turns it off (AICHAT-137)", () => {
    expect(parseEnv({}).RETENTION_INTERVAL_MINUTES).toBe(360);
    expect(parseEnv({ RETENTION_INTERVAL_MINUTES: "0" }).RETENTION_INTERVAL_MINUTES).toBe(0);
    expect(() => parseEnv({ RETENTION_INTERVAL_MINUTES: "-5" })).toThrow();
  });

  it("AC-45: rejects an invalid NODE_ENV value", () => {
    expect(() => parseEnv({ NODE_ENV: "not-a-real-env" })).toThrow();
  });
});

describe("loadEnv", () => {
  it("AC-45: parses and memoizes process.env on first call", () => {
    const first = loadEnv({ JWT_SECRET: "memoized-secret" });
    const second = loadEnv({ JWT_SECRET: "different-secret" });
    expect(first.JWT_SECRET).toBe("memoized-secret");
    expect(second).toBe(first);
  });
});
