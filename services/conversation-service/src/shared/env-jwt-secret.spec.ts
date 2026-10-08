import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { authMiddleware } from "./auth-middleware.js";
import { parseEnv } from "./env.js";
import { HttpError } from "./error-handler.js";

const STRONG_SECRET = "a-long-random-signing-secret-0123456789";

describe("JWT secret (H2)", () => {
  it("has no default JWT_SECRET: parsing without one throws", () => {
    expect(() => parseEnv({})).toThrow(/JWT_SECRET/);
  });

  it("rejects an empty JWT_SECRET", () => {
    expect(() => parseEnv({ JWT_SECRET: "" })).toThrow();
    expect(() => parseEnv({ JWT_SECRET: "" })).toThrow();
  });

  it("does not accept the former placeholder as a default", () => {
    const src = readFileSync(new URL("./env.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/JWT_SECRET[^\n]*\.default\(/);
    expect(src).not.toContain("change-me-in-every-environment");
  });

  it("returns 401 for a token forged with the old default secret", () => {
    const forged = jwt.sign({ sub: "attacker", email: "a@example.com" }, "change-me-in-every-environment");
    const req = { cookies: { access_token: forged }, headers: {} } as unknown as Request;
    const next = vi.fn();
    authMiddleware(parseEnv({ JWT_SECRET: STRONG_SECRET }).JWT_SECRET)(req, {} as Response, next);
    expect((next.mock.calls[0]?.[0] as HttpError).statusCode).toBe(401);
  });

  it("returns 401 for an unsigned (alg none) token", () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const forged = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "attacker", email: "a@example.com" })}.`;
    const req = { cookies: { access_token: forged }, headers: {} } as unknown as Request;
    const next = vi.fn();
    authMiddleware(STRONG_SECRET)(req, {} as Response, next);
    expect((next.mock.calls[0]?.[0] as HttpError).statusCode).toBe(401);
  });
});
