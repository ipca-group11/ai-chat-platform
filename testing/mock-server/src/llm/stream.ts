import type { MockContext } from "../registry.js";
import { Pacer } from "./pacer.js";
import { planScenario } from "./scenarios.js";
import { generateTokens } from "./text.js";

export class UnknownScenarioError extends Error {
  constructor(readonly scenario: string) {
    super(`Unknown scenario "${scenario}"`);
  }
}

/**
 * Streams the answer text of a scenario token by token, paced by TTFT_MS and
 * TOKEN_INTERVAL_MS. The text depends only on the scenario and SEED. Meant to be reused by
 * the other mocks (for example the chat stream of the conversation mock).
 *
 * Throws UnknownScenarioError for a name that is not a text scenario.
 */
export async function* streamScenarioText(
  scenario: string,
  ctx: Pick<MockContext, "config">,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<string, void> {
  const plan = planScenario("anthropic", scenario, ctx.config) ?? planScenario("openai", scenario, ctx.config);
  if (!plan) throw new UnknownScenarioError(scenario);
  const pacer = new Pacer(ctx.config);
  for (const token of generateTokens(ctx.config.seed, `${plan.name}/answer`, plan.tokens)) {
    if (options.signal?.aborted) return;
    await pacer.next();
    yield token;
  }
}
