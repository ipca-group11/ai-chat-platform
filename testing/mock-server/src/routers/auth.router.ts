import { Router } from "express";
import type { MockModule } from "../registry.js";

/** auth-service mock. Routes and scenarios are added by the story that fills this mock. */
export const authMock: MockModule = {
  name: "auth",
  mountPath: "/auth",
  createRouter() {
    return Router();
  },
};
