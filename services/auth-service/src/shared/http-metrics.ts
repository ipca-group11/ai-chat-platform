/**
 * HTTP request metrics (ARCHITECTURE.md §7), on prom-client's default registry, which
 * `/metrics` serves. Same names and labels as conversation-service so one Grafana
 * dashboard covers both: `http_requests_total` and `http_request_duration_seconds`,
 * labelled by method, route template and status.
 */
import type { NextFunction, Request, Response } from "express";
import { Counter, Histogram, register } from "prom-client";

const labelNames = ["method", "route", "status"] as const;

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames,
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames,
  registers: [register],
});

/**
 * Starts tracking the route template for the `route` label: the router mount plus the
 * matched path (`/auth` + `/login`), never the raw URL. Requests no route matched (404s) share the literal "unmatched".
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

export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
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
