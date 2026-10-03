import { Writable } from "node:stream";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { correlationMiddleware } from "./correlation-middleware.js";
import { createLogger } from "./logger.js";

function makeReqRes(headers: Record<string, string> = {}) {
  const setHeader = vi.fn();
  const req = { headers } as unknown as Request;
  const res = { setHeader } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, setHeader };
}

function noopLogger() {
  return createLogger("test-service", { destination: new Writable({ write: (_c, _e, cb) => cb() }) });
}

describe("correlationMiddleware", () => {
  it("AC-89: propagates the correlation ID when the header is present", () => {
    const { req, res, next, setHeader } = makeReqRes({ "x-correlation-id": "existing-id" });
    const middleware = correlationMiddleware(noopLogger());

    middleware(req, res, next);

    expect(req.correlationId).toBe("existing-id");
    expect(setHeader).toHaveBeenCalledWith("X-Correlation-Id", "existing-id");
    expect(next).toHaveBeenCalledOnce();
  });

  it("AC-89: generates a correlation ID when the header is absent", () => {
    const { req, res, next, setHeader } = makeReqRes();
    const middleware = correlationMiddleware(noopLogger());

    middleware(req, res, next);

    expect(req.correlationId).toBeTruthy();
    expect(typeof req.correlationId).toBe("string");
    expect(setHeader).toHaveBeenCalledWith("X-Correlation-Id", req.correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("AC-88: attaches a child logger on req.log bound to the correlation ID", () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = createLogger("test-service", { destination: stream });
    const { req, res, next } = makeReqRes({ "x-correlation-id": "corr-42" });
    const middleware = correlationMiddleware(logger);

    middleware(req, res, next);
    req.log!.info("handled");

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.correlationId).toBe("corr-42");
  });

  it("AC-89: echoes the same ID back on the response for two requests with different headers", () => {
    const first = makeReqRes({ "x-correlation-id": "id-1" });
    const second = makeReqRes({ "x-correlation-id": "id-2" });
    const middleware = correlationMiddleware(noopLogger());

    middleware(first.req, first.res, first.next);
    middleware(second.req, second.res, second.next);

    expect(first.setHeader).toHaveBeenCalledWith("X-Correlation-Id", "id-1");
    expect(second.setHeader).toHaveBeenCalledWith("X-Correlation-Id", "id-2");
  });
});
