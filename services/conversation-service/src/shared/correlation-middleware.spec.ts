import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { correlationMiddleware } from "./correlation-middleware.js";
import { createLogger } from "./logger.js";
import { CORRELATION_HEADER } from "./contracts/http.js";

describe("correlationMiddleware", () => {
  it("AC-45: generates a correlation id when absent and echoes it on the response", () => {
    const logger = createLogger("silent");
    const req = { headers: {} } as unknown as Request;
    const setHeader = vi.fn();
    const res = { setHeader } as unknown as Response;
    const next = vi.fn();

    correlationMiddleware(logger)(req, res, next);

    expect(req.correlationId).toBeTruthy();
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, req.correlationId);
    expect(req.log).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it("AC-45: reuses an incoming correlation id header", () => {
    const logger = createLogger("silent");
    const req = { headers: { "x-correlation-id": "incoming-id" } } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;

    correlationMiddleware(logger)(req, res, vi.fn());

    expect(req.correlationId).toBe("incoming-id");
  });
});
