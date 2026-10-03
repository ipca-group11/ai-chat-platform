import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

const SECRET = "unit-test-secret";
const OTHER_SECRET = "a-different-secret";

describe("jwt sign/verify (B4 contract)", () => {
  it("AC-40: a validly signed token verifies and yields the expected claims shape", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" }, SECRET);
    const claims = verifyAccessToken(token, SECRET);

    expect(claims.sub).toBe("user-1");
    expect(claims.email).toBe("a@b.com");
    expect(typeof claims.iat).toBe("number");
    expect(typeof claims.exp).toBe("number");
    expect(claims.exp - claims.iat).toBe(15 * 60);
  });

  it("AC-40: an expired token throws", () => {
    const token = jwt.sign({ sub: "user-1", email: "a@b.com" }, SECRET, {
      algorithm: "HS256",
      expiresIn: -10,
    });

    expect(() => verifyAccessToken(token, SECRET)).toThrow();
  });

  it("AC-40: a token signed with a different secret (tampered/mismatched) is rejected", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" }, OTHER_SECRET);

    expect(() => verifyAccessToken(token, SECRET)).toThrow();
  });

  it("AC-40: a structurally tampered token (payload altered post-signing) is rejected", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" }, SECRET);
    const [header, _payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: "attacker", email: "attacker@evil.com", iat: 0, exp: 9999999999 }),
    ).toString("base64url");

    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    expect(() => verifyAccessToken(tamperedToken, SECRET)).toThrow();
  });

  it("rejects a token with an unexpected algorithm (alg confusion)", () => {
    const token = jwt.sign({ sub: "user-1", email: "a@b.com" }, SECRET, {
      algorithm: "HS384",
      expiresIn: "15m",
    });

    expect(() => verifyAccessToken(token, SECRET)).toThrow();
  });
});
