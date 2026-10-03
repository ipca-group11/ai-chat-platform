import { Counter, Gauge, Histogram, Registry } from "prom-client";

/**
 * Metrics bundle returned by `createMetricsRegistry` (AC-91): a fresh `prom-client`
 * `Registry` plus the standard metrics every service exposes at `GET /metrics`.
 */
export interface ServiceMetrics {
  registry: Registry;
  httpRequestsTotal: Counter<"method" | "route" | "status">;
  httpRequestDurationSeconds: Histogram<"method" | "route" | "status">;
  activeStreams: Gauge<"service">;
}

/**
 * Creates a new, isolated `prom-client` registry with the standard HTTP + streaming
 * metrics registered on it. Each service calls this once at startup; the returned
 * `registry` is what `metricsHandler` serializes for `GET /metrics`.
 */
export function createMetricsRegistry(): ServiceMetrics {
  const registry = new Registry();

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests received.",
    labelNames: ["method", "route", "status"] as const,
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds.",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const activeStreams = new Gauge({
    name: "active_streams",
    help: "Number of currently open SSE streams.",
    labelNames: ["service"] as const,
    registers: [registry],
  });

  return { registry, httpRequestsTotal, httpRequestDurationSeconds, activeStreams };
}
