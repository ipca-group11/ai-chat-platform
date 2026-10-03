import { Router } from "express";
import type { MockModule } from "../registry.js";

/** conversation-service mock. Routes and scenarios are added by the story that fills this mock. */
export const conversationMock: MockModule = {
  name: "conversation",
  mountPath: "/api",
  createRouter() {
    return Router();
  },
};
