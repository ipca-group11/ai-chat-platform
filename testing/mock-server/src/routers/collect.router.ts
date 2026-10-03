import { Router } from "express";
import type { MockModule } from "../registry.js";

/** telemetry sink mock. Routes and scenarios are added by the story that fills this mock. */
export const collectMock: MockModule = {
  name: "collect",
  mountPath: "/collect",
  createRouter() {
    return Router();
  },
};
