import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { correlationIdMiddleware } from "./correlation-id.js";
import { http } from "./contracts/index.js";

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    headers,
  } as unknown as Response & { headers: Record<string, string> };
}

describe("correlationIdMiddleware", () => {
  it("AC-88: generates a correlation id when the header is absent", () => {
    const req = { headers: {} } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toBeTruthy();
    expect(res.setHeader).toHaveBeenCalledWith(http.CORRELATION_HEADER, req.correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("AC-88: propagates an existing correlation id unchanged", () => {
    const req = {
      headers: { "x-correlation-id": "incoming-id-123" },
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toBe("incoming-id-123");
    expect(res.setHeader).toHaveBeenCalledWith(http.CORRELATION_HEADER, "incoming-id-123");
  });
});
