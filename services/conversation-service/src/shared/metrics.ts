import type { NextFunction, Request, Response } from "express";
import { Counter, Gauge, Registry, collectDefaultMetrics, Histogram } from "prom-client";

/** Something that counts open connections; the `active_streams` gauge in production. */
export interface StreamCounter {
  inc(): void;
  dec(): void;
}

/**
 * Starts tracking the route template for the `route` label: the router mount plus the
 * matched path (`/chats` + `/:chatId/stream`), never the raw URL, so ids don't explode
 * cardinality. Requests no route matched (404s) share the literal "unmatched".
 *
 * The template is captured when Express assigns `req.route`, because by the time the
 * response finishes Express has already restored `req.baseUrl` on any request whose
 * handler called `next(err)`.
 */
export function captureRouteTemplate(req: Request): () => string {
  let template: string | undefined;
  let route: unknown = req.route;
  Object.defineProperty(req, "route", {
    configurable: true,
    enumerable: true,
    get: () => route,
    set: (value: unknown) => {
      route = value;
      const path = (value as { path?: unknown } | undefined)?.path;
      if (typeof path === "string") template = `${req.baseUrl}${path}` || "/";
    },
  });
  return () => template ?? "unmatched";
}

/** Prometheus metrics registry + HTTP middleware (ARCHITECTURE.md §7). */
export function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"] as const,
    registers: [registry],
  });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"] as const,
    registers: [registry],
  });

  const activeStreams = new Gauge({
    name: "active_streams",
    help: "Open SSE chat stream connections",
    registers: [registry],
  });

  function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    const routeTemplate = captureRouteTemplate(req);
    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = { method: req.method, route: routeTemplate(), status: String(res.statusCode) };
      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, durationSeconds);
    });
    next();
  }

  async function metricsHandler(_req: Request, res: Response) {
    res.setHeader("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  }

  return { registry, metricsMiddleware, metricsHandler, activeStreams: activeStreams as StreamCounter };
}
