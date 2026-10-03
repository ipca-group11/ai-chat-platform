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

  it("applies sane defaults for optional variables", () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(4001);
    expect(env.NODE_ENV).toBe("development");
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:3000"]);
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
