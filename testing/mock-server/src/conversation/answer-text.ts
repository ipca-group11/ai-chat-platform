import type { MockContext } from "../registry.js";

const SENTENCES = [
  "Here is a short summary of what you asked.",
  "Streaming responses arrive token by token.",
  "Let me break this down into three steps.",
  "The result depends on the provider and the model.",
  "You can attach a file and ask about its content.",
  "That works, and here is a small example.",
  "Both options are valid; the second is simpler to test.",
];

/** Scenarios the conversation mock knows for a streamed answer. */
export const ANSWER_SCENARIOS = ["ok", "long", "error"] as const;
export type AnswerScenario = (typeof ANSWER_SCENARIOS)[number];

export function isAnswerScenario(value: string | undefined): value is AnswerScenario {
  return (ANSWER_SCENARIOS as readonly string[]).includes(value ?? "");
}

/**
 * Tokens of a streamed answer. Local stand-in until the chat stream uses the LLM mock scenarios:
 * the text comes from the seeded generator, so the same SEED gives the same answer. `TOKENS`
 * sets the length; `long` is five times as long.
 */
export function answerText(scenario: string, ctx: Pick<MockContext, "config" | "rng">): string[] {
  const count = scenario === "long" ? ctx.config.tokens * 5 : ctx.config.tokens;
  const words: string[] = [];
  while (words.length < count) {
    words.push(...ctx.rng.pick(SENTENCES).split(" "));
  }
  return words.slice(0, count).map((word, index, all) => (index < all.length - 1 ? `${word} ` : word));
}
