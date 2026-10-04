import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  accessTokenClaimsSchema,
  authResponseSchema,
  isValidPassword,
  loginRequestSchema,
  passwordSchema,
  registerRequestSchema,
} from "./auth.js";

describe("passwordSchema", () => {
  it.each([
    ["abcdefg1", true],
    ["short1a", false],
    ["12345678", false],
    ["abcdefgh", false],
  ])("%s -> %s", (value, ok) => {
    expect(isValidPassword(value)).toBe(ok);
  });

  it("reports which rule failed", () => {
    const messages = passwordSchema.safeParse("12345678").error?.issues.map((i) => i.message);
    expect(messages).toEqual(["Password must contain at least one letter"]);
  });
});

describe("request schemas", () => {
  it("trims and lower-cases the e-mail on register", () => {
    const parsed = registerRequestSchema.parse({ email: "  Ana@Example.COM ", password: "abcdefg1" });
    expect(parsed.email).toBe("ana@example.com");
  });

  it("rejects a weak password on register but not on login", () => {
    expect(registerRequestSchema.safeParse({ email: "a@b.pt", password: "x" }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ email: "a@b.pt", password: "x" }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ email: "a@b.pt", password: "" }).success).toBe(false);
  });

  it("rejects an invalid e-mail", () => {
    expect(loginRequestSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});

describe("response and token schemas", () => {
  it("accepts a profile with an ISO date and rejects a bad date", () => {
    const user = { id: "1", email: "a@b.pt", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(authResponseSchema.safeParse({ user }).success).toBe(true);
    expect(authResponseSchema.safeParse({ user: { ...user, createdAt: "yesterday" } }).success).toBe(false);
  });

  it("requires integer iat and exp in the claims", () => {
    const claims = { sub: "1", email: "a@b.pt", iat: 1, exp: 2 };
    expect(accessTokenClaimsSchema.safeParse(claims).success).toBe(true);
    expect(accessTokenClaimsSchema.safeParse({ ...claims, exp: 2.5 }).success).toBe(false);
  });

  it("keeps the access token shorter-lived than the refresh token", () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(REFRESH_TOKEN_TTL_SECONDS).toBeGreaterThan(ACCESS_TOKEN_TTL_SECONDS);
  });
});
