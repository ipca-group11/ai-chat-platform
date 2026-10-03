import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { metricsHandler } from "./metrics-handler.js";
import { createMetricsRegistry } from "./registry.js";

describe("metricsHandler", () => {
  it("AC-91: returns valid Prometheus exposition text including registered metrics", async () => {
    const metrics = createMetricsRegistry();
    metrics.httpRequestsTotal.inc({ method: "GET", route: "/chats", status: "200" });

    const setHeader = vi.fn();
    const send = vi.fn();
    const res = { setHeader, send } as unknown as Response;
    const req = {} as Request;

    await metricsHandler(metrics)(req, res);

    expect(setHeader).toHaveBeenCalledWith("Content-Type", metrics.registry.contentType);
    expect(send).toHaveBeenCalledOnce();
    const body = send.mock.calls[0]?.[0] as string;
    expect(body).toContain("http_requests_total");
    expect(body).toContain("# HELP");
    expect(body).toContain("# TYPE");
  });

  it("AC-91: returns exposition text even with no recorded requests yet", async () => {
    const metrics = createMetricsRegistry();
    const setHeader = vi.fn();
    const send = vi.fn();
    const res = { setHeader, send } as unknown as Response;

    await metricsHandler(metrics)({} as Request, res);

    const body = send.mock.calls[0]?.[0] as string;
    expect(typeof body).toBe("string");
    expect(body).toContain("active_streams");
  });
});
