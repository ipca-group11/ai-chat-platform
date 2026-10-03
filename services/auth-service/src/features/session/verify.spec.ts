import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { env } from "../../shared/env.js";
import { HttpError } from "../../shared/error-middleware.js";
import { signAccessToken } from "../../shared/jwt.js";
import { requireAuth, verifyAccessToken } from "./verify.js";

function mockReq(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

describe("verifyAccessToken (B4 contract)", () => {
  it("AC-40: verifies a token issued by this service using JWT_SECRET", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" }, env.JWT_SECRET);
    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe("user-1");
    expect(claims.email).toBe("a@b.com");
  });

  it("AC-40: throws for a token signed with a different secret", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" }, "wrong-secret");
    expect(() => verifyAccessToken(token)).toThrow();
  });
});

describe("requireAuth middleware", () => {
  it("AC-35: calls next() and attaches userId/userEmail for a valid access token cookie", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" }, env.JWT_SECRET);
    const req = mockReq({ access_token: token });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(req.userId).toBe("user-1");
    expect(req.userEmail).toBe("a@b.com");
    expect(next).toHaveBeenCalledWith();
  });

  it("responds 401 (via next(err)) when the access_token cookie is missing", () => {
    const req = mockReq({});
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]?.[0] as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHENTICATED");
  });

  it("responds 401 when the access_token cookie is invalid/tampered", () => {
    const req = mockReq({ access_token: "not-a-valid-jwt" });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    const err = next.mock.calls[0]?.[0] as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
  });

  it("responds 401 when the access_token cookie is signed with the wrong secret", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" }, "some-other-secret");
    const req = mockReq({ access_token: token });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    const err = next.mock.calls[0]?.[0] as HttpError;
    expect(err.status).toBe(401);
  });
});
