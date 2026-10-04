import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const base = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/auth",
  JWT_SECRET: "test-secret",
};

describe("loadEnv", () => {
  it("AC-33: throws when a required variable (e.g. JWT_SECRET) is missing", () => {
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow();
  });

  it("refuses to start without JWT_SECRET in every NODE_ENV, with no fallback secret (AICHAT-210)", () => {
    for (const NODE_ENV of ["production", "development", "test", undefined]) {
      expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL, NODE_ENV })).toThrow(/JWT_SECRET is required/);
    }
    expect(() => loadEnv({ ...base, JWT_SECRET: "" })).toThrow(/JWT_SECRET is required/);
  });

  it("applies sane defaults for optional variables", () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(4001);
    expect(env.NODE_ENV).toBe("development");
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:3000"]);
  });

  it("has no service token or conversation-service URL by default, so account deletion stays off (AICHAT-79)", () => {
    const env = loadEnv(base);
    expect(env.INTERNAL_SERVICE_TOKEN).toBeUndefined();
    expect(env.CONVERSATION_SERVICE_URL).toBeUndefined();
  });

  it("reads the service token and the conversation-service URL, and rejects a short token", () => {
    const env = loadEnv({ ...base, INTERNAL_SERVICE_TOKEN: "x".repeat(32), CONVERSATION_SERVICE_URL: "http://conversation-service:4002" });
    expect(env.INTERNAL_SERVICE_TOKEN).toBe("x".repeat(32));
    expect(env.CONVERSATION_SERVICE_URL).toBe("http://conversation-service:4002");
    expect(() => loadEnv({ ...base, INTERNAL_SERVICE_TOKEN: "short" })).toThrow();
  });

  it("runs the retention job every 6 hours by default, and 0 turns it off (AICHAT-137)", () => {
    expect(loadEnv(base).RETENTION_INTERVAL_MINUTES).toBe(360);
    expect(loadEnv({ ...base, RETENTION_INTERVAL_MINUTES: "0" }).RETENTION_INTERVAL_MINUTES).toBe(0);
    expect(() => loadEnv({ ...base, RETENTION_INTERVAL_MINUTES: "-1" })).toThrow();
  });

  it("parses a comma-separated CORS_ORIGIN into a list", () => {
    const env = loadEnv({
      ...base,
      CORS_ORIGIN: "http://localhost:3000, http://localhost:3001",
    });
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:3000", "http://localhost:3001"]);
  });

  it("treats COOKIE_SECURE=false as insecure (local http dev only)", () => {
    const env = loadEnv({ ...base, COOKIE_SECURE: "false" });
    expect(env.COOKIE_SECURE).toBe(false);
  });
});
