import type { Request, Response } from "express";
import type { ServiceMetrics } from "./registry.js";

/**
 * Returns an Express handler for `GET /metrics` (AC-91) that serializes the registry's
 * current metrics in Prometheus text exposition format, setting the content type
 * `prom-client` requires (`registry.contentType`).
 */
export function metricsHandler(metrics: ServiceMetrics) {
  return async function metricsHandlerFn(_req: Request, res: Response): Promise<void> {
    res.setHeader("Content-Type", metrics.registry.contentType);
    res.send(await metrics.registry.metrics());
  };
}
