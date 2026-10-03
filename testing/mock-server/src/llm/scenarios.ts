import type { MockConfig } from "../config.js";
import type { ScenarioDefinition } from "../registry.js";

export type LlmProvider = "anthropic" | "openai";
export type StopReason = "end_turn" | "max_tokens" | "pause_turn";

/** What a text scenario produces, independent of the provider wire format. */
export interface ScenarioPlan {
  name: string;
  /** Tokens in the visible answer. */
  tokens: number;
  /** Tokens of thinking before the answer (Anthropic only). */
  thinkingTokens: number;
  /** The answer goes through a web fetch tool call (Anthropic only). */
  webFetch: boolean;
  stopReason: StopReason;
}

const LONG_FACTOR = 10;

interface TextScenario {
  description: string;
  providers: LlmProvider[];
  plan(config: MockConfig): Omit<ScenarioPlan, "name">;
}

const TEXT_SCENARIOS: Record<string, TextScenario> = {
  ok: {
    description: "Normal answer of TOKENS tokens that ends with end_turn",
    providers: ["anthropic", "openai"],
    plan: (c) => ({ tokens: c.tokens, thinkingTokens: 0, webFetch: false, stopReason: "end_turn" }),
  },
  long: {
    description: "Answer ten times longer than TOKENS",
    providers: ["anthropic", "openai"],
    plan: (c) => ({ tokens: c.tokens * LONG_FACTOR, thinkingTokens: 0, webFetch: false, stopReason: "end_turn" }),
  },
  thinking: {
    description: "A thinking block (with signature) before the answer",
    providers: ["anthropic"],
    plan: (c) => ({
      tokens: c.tokens,
      thinkingTokens: Math.max(1, Math.floor(c.tokens / 2)),
      webFetch: false,
      stopReason: "end_turn",
    }),
  },
  "web-fetch": {
    description: "The answer uses a web_fetch server tool call and its result",
    providers: ["anthropic"],
    plan: (c) => ({ tokens: c.tokens, thinkingTokens: 0, webFetch: true, stopReason: "end_turn" }),
  },
  "pause-turn": {
    description: "Stops with pause_turn after a web fetch; the continuation request ends with end_turn",
    providers: ["anthropic"],
    plan: (c) => ({ tokens: c.tokens, thinkingTokens: 0, webFetch: true, stopReason: "pause_turn" }),
  },
  "max-tokens": {
    description: "Answer cut short: stop reason max_tokens (finish_reason length on OpenAI)",
    providers: ["anthropic", "openai"],
    plan: (c) => ({ tokens: c.tokens, thinkingTokens: 0, webFetch: false, stopReason: "max_tokens" }),
  },
};

/** The plan of a text scenario for this provider, or undefined when the name is not one. */
export function planScenario(provider: LlmProvider, name: string, config: MockConfig): ScenarioPlan | undefined {
  const scenario = Object.hasOwn(TEXT_SCENARIOS, name) ? TEXT_SCENARIOS[name] : undefined;
  if (!scenario || !scenario.providers.includes(provider)) return undefined;
  return { name, ...scenario.plan(config) };
}

/** Scenario definitions of one provider, for `/__admin/scenarios`. */
export function scenarioDefinitions(provider: LlmProvider): ScenarioDefinition[] {
  return Object.entries(TEXT_SCENARIOS)
    .filter(([, scenario]) => scenario.providers.includes(provider))
    .map(([name, scenario]) => ({ mock: provider, name, description: scenario.description }));
}

export const DEFAULT_SCENARIO = "ok";
