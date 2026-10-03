import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { createMetrics } from "./metrics.js";

describe("createMetrics", () => {
  it("AC-45: records request duration and exposes it via the /metrics handler", async () => {
    const { metricsMiddleware, metricsHandler } = createMetrics();

    let finishCallback: (() => void) | undefined;
    const req = { method: "GET", path: "/chats", route: { path: "/chats" } } as unknown as Request;
    const res = {
      statusCode: 200,
      on: (event: string, cb: () => void) => {
        if (event === "finish") finishCallback = cb;
      },
    } as unknown as Response;

    metricsMiddleware(req, res, vi.fn());
    finishCallback?.();

    const send = vi.fn();
    const setHeader = vi.fn();
    await metricsHandler({} as Request, { setHeader, send } as unknown as Response);

    expect(setHeader).toHaveBeenCalledWith("Content-Type", expect.stringContaining("text/plain"));
    expect(send).toHaveBeenCalledWith(expect.stringContaining("http_request_duration_seconds"));
  });
});
