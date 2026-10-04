import { Router } from "express";
import type { MockModule } from "../registry.js";

/**
 * Telemetry sink: accepts the payloads Grafana Faro sends to `POST /collect` and answers 202.
 * The payloads are kept by the request log; read them with `GET /__admin/requests?mock=collect`.
 */
export const collectMock: MockModule = {
  name: "collect",
  mountPath: "/collect",
  createRouter() {
    const router = Router();

    // The browser SDK posts from the app origin, so it sends a preflight first.
    router.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      next();
    });

    router.post("/", (_req, res) => {
      res.status(202).json({ status: "accepted" });
    });

    return router;
  },
};
