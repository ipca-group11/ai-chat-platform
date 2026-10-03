import type { Request } from "express";
import type { MockContext } from "../registry.js";
import { DEFAULT_SCENARIO } from "./scenarios.js";

/** Names of the scenarios a provider mock accepts, for error messages. */
export function availableScenarios(ctx: Pick<MockContext, "scenarios">, provider: string): string {
  return ctx.scenarios
    .list()
    .filter((s) => s.mock === provider)
    .map((s) => s.name)
    .join(", ");
}

export const SCENARIO_HEADER = "x-mock-scenario";
/** Separates the model name from the scenario: `claude-sonnet-4-5@thinking`. */
export const MODEL_SUFFIX_SEPARATOR = "@";

export interface Selection {
  scenario: string;
  /** The model without the scenario suffix, as the mock echoes it back. */
  model: string;
}

/**
 * Picks the scenario of a request: the `X-Mock-Scenario` header wins, then the model name
 * suffix (`model@scenario`), then `ok`.
 */
export function selectScenario(req: Request, requestedModel: string): Selection {
  const at = requestedModel.indexOf(MODEL_SUFFIX_SEPARATOR);
  const model = at === -1 ? requestedModel : requestedModel.slice(0, at);
  const suffix = at === -1 ? "" : requestedModel.slice(at + 1).trim();
  const header = req.header(SCENARIO_HEADER)?.trim();
  return { scenario: header || suffix || DEFAULT_SCENARIO, model };
}
