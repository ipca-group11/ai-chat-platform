import type { NextFunction, Request, Response } from "express";
import type { ServiceMetrics } from "./registry.js";

/**
 * Express middleware (AC-91) that observes every request's duration and increments the
 * request counter, labeled by method/route/status. Mount before route handlers so it wraps
 * the full request lifecycle; relies on `res.on("finish")` so it fires exactly once per
 * response, success or error.
 */
export function httpMetricsMiddleware(metrics: ServiceMetrics) {
  return function httpMetricsMiddlewareHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ?? req.path ?? "unknown";
      const labels = {
        method: req.method,
        route: String(route),
        status: String(res.statusCode),
      };

      metrics.httpRequestsTotal.inc(labels);
      metrics.httpRequestDurationSeconds.observe(labels, durationSeconds);
    });

    next();
  };
}
