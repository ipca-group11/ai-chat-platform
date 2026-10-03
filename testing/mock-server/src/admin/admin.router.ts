import { Router } from "express";
import type { MockContext } from "../registry.js";

export interface AdminOptions {
  ctx: MockContext;
  /** Runs every reset hook and restores the start-up state. */
  reset(): void;
}

/** `/__admin/*`: control endpoints for tests. Not delayed and never failed by ERROR_RATE. */
export function createAdminRouter({ ctx, reset }: AdminOptions): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/scenarios", (_req, res) => {
    res.json({ scenarios: ctx.scenarios.list() });
  });

  router.post("/reset", (_req, res) => {
    reset();
    res.json({ status: "reset" });
  });

  return router;
}
