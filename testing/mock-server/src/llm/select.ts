import type { Request } from "express";
import { DEFAULT_SCENARIO } from "./scenarios.js";

/** Reads the scenario a request asked for: the `X-Mock-Scenario` header, else `ok`. */
export function selectScenario(req: Request): string {
  const header = req.header("x-mock-scenario")?.trim();
  return header && header.length > 0 ? header : DEFAULT_SCENARIO;
}
