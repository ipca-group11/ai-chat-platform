import { describe, expect, it } from "vitest";
import { ACCESS_TOKEN_COOKIE, accessTokenClaimsSchema } from "./auth.js";

describe("access token claims", () => {
  const claims = { sub: "user-1", email: "ana@example.com", iat: 1, exp: 2 };

  it("accepts a complete claim set", () => {
    expect(accessTokenClaimsSchema.parse(claims)).toEqual(claims);
  });

  it.each([
    ["missing sub", { ...claims, sub: undefined }],
    ["bad email", { ...claims, email: "nope" }],
    ["fractional iat", { ...claims, iat: 1.5 }],
    ["string exp", { ...claims, exp: "2" }],
  ])("rejects %s", (_name, value) => {
    expect(accessTokenClaimsSchema.safeParse(value).success).toBe(false);
  });

  it("reads the token from the agreed cookie name", () => {
    expect(ACCESS_TOKEN_COOKIE).toBe("access_token");
  });
});
