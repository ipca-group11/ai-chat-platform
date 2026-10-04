import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { authMiddleware } from "./auth-middleware.js";
import { HttpError } from "./error-handler.js";

const SECRET = "test-secret";

function makeReq(overrides: Partial<Request> = {}): Request {
  return { cookies: {}, headers: {}, ...overrides } as Request;
}

describe("authMiddleware", () => {
  it("AC-45: sets req.userId from a valid access_token cookie", () => {
    const token = jwt.sign({ sub: "user-1", email: "a@example.com" }, SECRET, { expiresIn: "15m" });
    const req = makeReq({ cookies: { access_token: token } });
    const next = vi.fn();

    authMiddleware(SECRET)(req, {} as Response, next);

    expect(req.userId).toBe("user-1");
    expect(next).toHaveBeenCalledWith();
  });

  it("AC-45: accepts an Authorization: Bearer header as a fallback", () => {
    const token = jwt.sign({ sub: "user-2", email: "b@example.com" }, SECRET, { expiresIn: "15m" });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn();

    authMiddleware(SECRET)(req, {} as Response, next);

    expect(req.userId).toBe("user-2");
  });

  it("sets req.userEmailVerified only when the email_verified claim is true (AICHAT-253)", () => {
    const verified = (claims: Record<string, unknown>) => {
      const token = jwt.sign({ sub: "user-4", email: "v@example.com", ...claims }, SECRET, { expiresIn: "15m" });
      const req = makeReq({ cookies: { access_token: token } });
      authMiddleware(SECRET)(req, {} as Response, vi.fn());
      return req.userEmailVerified;
    };
    expect(verified({ email_verified: true })).toBe(true);
    expect(verified({ email_verified: false })).toBe(false);
    expect(verified({})).toBe(false);
  });

  it("rejects a token whose email_verified claim is not a boolean", () => {
    const token = jwt.sign({ sub: "user-5", email: "v@example.com", email_verified: "true" }, SECRET, { expiresIn: "15m" });
    const next = vi.fn();
    authMiddleware(SECRET)(makeReq({ cookies: { access_token: token } }), {} as Response, next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(HttpError);
  });

  it("sets req.userEmail from the email claim, lowercased", () => {
    const token = jwt.sign({ sub: "user-3", email: "Mixed.Case@Example.com" }, SECRET, { expiresIn: "15m" });
    const req = makeReq({ cookies: { access_token: token } });

    authMiddleware(SECRET)(req, {} as Response, vi.fn());

    expect(req.userEmail).toBe("mixed.case@example.com");
  });

  it("AC-45: 401s on a missing token", () => {
    const req = makeReq();
    const next = vi.fn();

    authMiddleware(SECRET)(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    const err = next.mock.calls[0]?.[0] as HttpError;
    expect(err.statusCode).toBe(401);
  });

  it("AC-45: 401s on an expired/invalid token", () => {
    const badToken = jwt.sign({ sub: "user-1", email: "a@example.com" }, "wrong-secret", { expiresIn: "15m" });
    const req = makeReq({ cookies: { access_token: badToken } });
    const next = vi.fn();

    authMiddleware(SECRET)(req, {} as Response, next);

    const err = next.mock.calls[0]?.[0] as HttpError;
    expect(err.statusCode).toBe(401);
  });
});
