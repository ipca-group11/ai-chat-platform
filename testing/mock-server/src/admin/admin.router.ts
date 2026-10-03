import { Router } from "express";
import { countRecords, DATASET_NAMES, isDatasetName } from "../data/datasets.js";
import { registerFaultRoutes } from "../faults/faults.js";
import type { RequestLog } from "../core/request-log.js";
import type { MockContext } from "../registry.js";

export interface AdminOptions {
  ctx: MockContext;
  /** Runs every reset hook and restores the start-up state. */
  reset(): void;
  /** Requests the mocks received. */
  requests: RequestLog;
}

/** `/__admin/*`: control endpoints for tests. Not delayed and never failed by ERROR_RATE. */
export function createAdminRouter({ ctx, reset, requests }: AdminOptions): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/scenarios", (_req, res) => {
    res.json({ scenarios: ctx.scenarios.list() });
  });

  router.post("/seed/:dataset", (req, res) => {
    const name = req.params.dataset;
    if (!isDatasetName(name)) {
      res.status(404).json({
        error: { code: "unknown_dataset", message: `Unknown dataset "${name}"`, available: DATASET_NAMES },
      });
      return;
    }
    ctx.store.load(name);
    res.json({ dataset: name, counts: countRecords(ctx.store.data) });
  });

  router.get("/data", (_req, res) => {
    res.json({ dataset: ctx.store.name, counts: countRecords(ctx.store.data), data: ctx.store.data });
  });

  router.get("/requests", (req, res) => {
    const mock = typeof req.query.mock === "string" ? req.query.mock : undefined;
    const list = requests.list({ mock });
    res.json({ count: list.length, requests: list });
  });

  registerFaultRoutes(router, ctx);

  router.post("/reset", (_req, res) => {
    reset();
    res.json({ status: "reset" });
  });

  return router;
}
