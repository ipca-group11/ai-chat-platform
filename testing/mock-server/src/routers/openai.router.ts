import { Router } from "express";
import type { MockModule } from "../registry.js";

/** OpenAI mock. Routes and scenarios are added by the story that fills this mock. */
export const openaiMock: MockModule = {
  name: "openai",
  mountPath: "/openai",
  createRouter() {
    return Router();
  },
};
