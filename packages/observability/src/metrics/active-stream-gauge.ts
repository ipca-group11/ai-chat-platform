import type { ServiceMetrics } from "./registry.js";

/**
 * Helpers for `conversation-service`'s SSE handler (AC-91) to report concurrent open
 * streams via the `active_streams` gauge. Call `incActiveStream` when a stream opens and
 * `decActiveStream` in its `finally`/`close` handler so the gauge stays accurate even when
 * a stream ends abnormally.
 */
export function incActiveStream(metrics: ServiceMetrics, service: string): void {
  metrics.activeStreams.inc({ service });
}

export function decActiveStream(metrics: ServiceMetrics, service: string): void {
  metrics.activeStreams.dec({ service });
}
