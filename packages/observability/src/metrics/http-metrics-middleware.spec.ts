import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { httpMetricsMiddleware } from "./http-metrics-middleware.js";
import { createMetricsRegistry } from "./registry.js";

function makeReqRes(overrides: { method?: string; path?: string; statusCode?: number } = {}) {
  const res = new EventEmitter() as unknown as Response;
  (res as unknown as { statusCode: number }).statusCode = overrides.statusCode ?? 200;
  const req = {
    method: overrides.method ?? "GET",
    path: overrides.path ?? "/chats",
    route: undefined,
  } as unknown as Request;
  return { req, res };
}

describe("httpMetricsMiddleware", () => {
  it("AC-91: increments http_requests_total on response finish", async () => {
    const metrics = createMetricsRegistry();
    const middleware = httpMetricsMiddleware(metrics);
    const { req, res } = makeReqRes({ method: "GET", path: "/chats", statusCode: 200 });
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    (res as unknown as EventEmitter).emit("finish");

    const json = await metrics.registry.getMetricsAsJSON();
    const counter = json.find((m) => m.name === "http_requests_total");
    const value = counter?.values.find(
      (v) => v.labels.method === "GET" && v.labels.status === "200",
    );
    expect(value?.value).toBe(1);
  });

  it("AC-91: observes request duration in the histogram on finish", async () => {
    const metrics = createMetricsRegistry();
    const middleware = httpMetricsMiddleware(metrics);
    const { req, res } = makeReqRes();
    const next = vi.fn();

    middleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");

    const json = await metrics.registry.getMetricsAsJSON();
    const histogram = json.find((m) => m.name === "http_request_duration_seconds");
    const countValue = histogram?.values.find((v) => v.metricName?.endsWith("_count"));
    expect(countValue?.value).toBe(1);
  });

  it("AC-91: prefers the matched route pattern over the raw path when available", async () => {
    const metrics = createMetricsRegistry();
    const middleware = httpMetricsMiddleware(metrics);
    const { req, res } = makeReqRes({ method: "GET", path: "/chats/123", statusCode: 200 });
    (req as unknown as { route: { path: string } }).route = { path: "/chats/:id" };
    const next = vi.fn();

    middleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");

    const json = await metrics.registry.getMetricsAsJSON();
    const counter = json.find((m) => m.name === "http_requests_total");
    const value = counter?.values.find((v) => v.labels.route === "/chats/:id");
    expect(value?.value).toBe(1);
  });

  it("AC-91: labels the counter with the error status for a failed request", async () => {
    const metrics = createMetricsRegistry();
    const middleware = httpMetricsMiddleware(metrics);
    const { req, res } = makeReqRes({ method: "POST", path: "/chats", statusCode: 500 });
    const next = vi.fn();

    middleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");

    const json = await metrics.registry.getMetricsAsJSON();
    const counter = json.find((m) => m.name === "http_requests_total");
    const value = counter?.values.find(
      (v) => v.labels.method === "POST" && v.labels.status === "500",
    );
    expect(value?.value).toBe(1);
  });
});
