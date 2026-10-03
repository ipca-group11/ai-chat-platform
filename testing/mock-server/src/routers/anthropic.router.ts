import { Router } from "express";
import type { MockModule } from "../registry.js";

/** Anthropic mock. Routes and scenarios are added by the story that fills this mock. */
export const anthropicMock: MockModule = {
  name: "anthropic",
  mountPath: "/anthropic",
  createRouter() {
    return Router();
  },
};
