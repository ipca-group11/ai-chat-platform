import type { MockConfig } from "../config.js";
import type { ScenarioDefinition } from "../registry.js";
import { errorScenarioDefinitions } from "./errors.js";

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
  /** The connection closes in the middle of the answer, without a closing event. */
  drop: boolean;
  /** Extra wait before the first token, on top of TTFT_MS. */
  firstTokenDelayMs: number;
}

const LONG_FACTOR = 10;
/** How much later the first token arrives in the `slow` scenario. */
export const SLOW_FIRST_TOKEN_MS = 5000;

type PlanBody = Omit<ScenarioPlan, "name" | "drop" | "firstTokenDelayMs">;

interface TextScenario {
  description: string;
  providers: LlmProvider[];
  plan(config: MockConfig): PlanBody;
  drop?: boolean;
  slow?: boolean;
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
  drop: {
    description: "Closes the connection halfway through the answer, with no closing event",
    providers: ["anthropic", "openai"],
    plan: (c) => ({ tokens: c.tokens, thinkingTokens: 0, webFetch: false, stopReason: "end_turn" }),
    drop: true,
  },
  slow: {
    description: `The first token arrives ${SLOW_FIRST_TOKEN_MS} ms later than TTFT_MS says`,
    providers: ["anthropic", "openai"],
    plan: (c) => ({ tokens: c.tokens, thinkingTokens: 0, webFetch: false, stopReason: "end_turn" }),
    slow: true,
  },
};

/** The plan of a text scenario for this provider, or undefined when the name is not one. */
export function planScenario(provider: LlmProvider, name: string, config: MockConfig): ScenarioPlan | undefined {
  const scenario = Object.hasOwn(TEXT_SCENARIOS, name) ? TEXT_SCENARIOS[name] : undefined;
  if (!scenario || !scenario.providers.includes(provider)) return undefined;
  return {
    name,
    ...scenario.plan(config),
    drop: scenario.drop ?? false,
    firstTokenDelayMs: scenario.slow ? SLOW_FIRST_TOKEN_MS : 0,
  };
}

/** Scenario definitions of one provider, for `/__admin/scenarios`. */
export function scenarioDefinitions(provider: LlmProvider): ScenarioDefinition[] {
  const text = Object.entries(TEXT_SCENARIOS)
    .filter(([, scenario]) => scenario.providers.includes(provider))
    .map(([name, scenario]) => ({ mock: provider, name, description: scenario.description }));
  return [...text, ...errorScenarioDefinitions(provider)];
}

export const DEFAULT_SCENARIO = "ok";
