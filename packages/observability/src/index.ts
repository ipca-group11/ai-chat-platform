/**
 * Public API of `packages/observability` (O1/O2). Re-exports the `logging` and `metrics`
 * sub-modules as namespaces, mirroring the `packages/shared-types` convention: consumers
 * import `{ logging, metrics } from "@platform/observability"` (or the `/logging`,
 * `/metrics` subpaths directly).
 */
export * as logging from "./logging/index.js";
export * as metrics from "./metrics/index.js";
