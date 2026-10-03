import { Router } from "express";
import type { MockModule } from "../registry.js";

/** MFE remotes mock. Routes and scenarios are added by the story that fills this mock. */
export const remotesMock: MockModule = {
  name: "remotes",
  mountPath: "/remotes",
  createRouter() {
    return Router();
  },
};
