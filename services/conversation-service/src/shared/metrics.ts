import type { NextFunction, Request, Response } from "express";
import { Registry, collectDefaultMetrics, Histogram } from "prom-client";

/** Prometheus metrics registry + HTTP middleware (ARCHITECTURE.md §7). */
export function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"] as const,
    registers: [registry],
  });

  function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ?? req.path;
      httpRequestDuration.observe(
        { method: req.method, route, status: String(res.statusCode) },
        durationSeconds,
      );
    });
    next();
  }

  async function metricsHandler(_req: Request, res: Response) {
    res.setHeader("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  }

  return { registry, metricsMiddleware, metricsHandler };
}
