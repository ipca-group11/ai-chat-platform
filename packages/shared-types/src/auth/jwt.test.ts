import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  accessTokenClaimsSchema,
} from "./jwt";

describe("accessTokenClaimsSchema", () => {
  it("AC-8: accepts a well-formed claims object", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = accessTokenClaimsSchema.safeParse({
      sub: "user-1",
      email: "user@example.com",
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: rejects claims missing required fields", () => {
    const result = accessTokenClaimsSchema.safeParse({ sub: "user-1" });
    expect(result.success).toBe(false);
  });
});

describe("token TTL constants", () => {
  it("AC-8: access token TTL is 15 minutes (STACK.md decision #2)", () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
  });

  it("AC-8: refresh token TTL is 7 days (STACK.md decision #2)", () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });
});
