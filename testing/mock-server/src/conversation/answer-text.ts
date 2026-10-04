import type { MockContext } from "../registry.js";
import { streamScenarioText } from "../llm/stream.js";

/** Scenarios the conversation mock knows for a streamed answer. */
export const ANSWER_SCENARIOS = ["ok", "long", "error", "truncated"] as const;
export type AnswerScenario = (typeof ANSWER_SCENARIOS)[number];

export function isAnswerScenario(value: string | undefined): value is AnswerScenario {
  return (ANSWER_SCENARIOS as readonly string[]).includes(value ?? "");
}

/**
 * The LLM mock scenario that supplies the text of each chat scenario. `error` reuses the `ok`
 * text: the conversation engine ends it with a provider error after the second token.
 * `truncated` is the `max-tokens` text: the engine saves it marked as cut off (AICHAT-212).
 */
const LLM_SCENARIO: Record<AnswerScenario, string> = { ok: "ok", long: "long", error: "ok", truncated: "max-tokens" };

/** Name of the LLM scenario behind a chat scenario; fails with the list of valid names otherwise. */
export function llmScenarioFor(scenario: string): string {
  if (!isAnswerScenario(scenario)) {
    throw new Error(`Unknown answer scenario "${scenario}". Available: ${ANSWER_SCENARIOS.join(", ")}`);
  }
  return LLM_SCENARIO[scenario];
}

/**
 * Tokens of a streamed answer, paced by TTFT_MS and TOKEN_INTERVAL_MS. The text comes from the
 * LLM mock (`streamScenarioText`), so the chat answers reuse its scenarios: the same SEED gives
 * the same answer, and `long` is ten times TOKENS.
 */
export function answerStream(
  scenario: string,
  ctx: Pick<MockContext, "config">,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<string, void> {
  return streamScenarioText(llmScenarioFor(scenario), ctx, options);
}
