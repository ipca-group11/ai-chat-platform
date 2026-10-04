import { readdir } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// The adapters are the code under test, so they are imported from their service on purpose.
/* eslint-disable @nx/enforce-module-boundaries */
import { AnthropicProvider } from "../../../../services/conversation-service/src/features/llm-adapters/anthropic.provider.js";
import { OpenAiProvider } from "../../../../services/conversation-service/src/features/llm-adapters/openai.provider.js";
import {
  ProviderError,
  type LlmProvider,
  type LlmStreamChunk,
} from "../../../../services/conversation-service/src/features/llm-adapters/types.js";
/* eslint-enable @nx/enforce-module-boundaries */
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { fixturesDir, REPLAY_PREFIX } from "../llm/replay.js";
import type { LlmProvider as ProviderName } from "../llm/scenarios.js";

/**
 * Contract test: the real LLM adapters of conversation-service parse what the LLM mock sends.
 * Every scenario the mock registers is called through the adapter. A scenario without an
 * expectation below fails the test, so the mock cannot grow a scenario nobody checked, and a
 * change to the wire format that the adapters do not understand fails here too.
 */

type Outcome =
  | { kind: "text" }
  | { kind: "reasoning" }
  | { kind: "web_fetch" }
  /** The adapter raises a ProviderError for this HTTP status. */
  | { kind: "error"; statusCode: number; retryable: boolean }
  /**
   * The connection closes halfway: the adapter must fail, not hang or return a short answer as if
   * it were whole. Today it lets fetch's own `TypeError: terminated` through instead of a
   * ProviderError (finding for AICHAT-25, see the work log).
   */
  | { kind: "truncated" };

const TEXT: Outcome = { kind: "text" };
const EXPECTED: Record<ProviderName, Record<string, Outcome>> = {
  anthropic: {
    ok: TEXT,
    long: TEXT,
    "max-tokens": TEXT,
    slow: TEXT,
    thinking: { kind: "reasoning" },
    "web-fetch": { kind: "web_fetch" },
    "pause-turn": { kind: "web_fetch" },
    "inject-obey": { kind: "web_fetch" },
    "inject-resist": TEXT,
    drop: { kind: "truncated" },
    "error-401": { kind: "error", statusCode: 401, retryable: false },
    "error-429": { kind: "error", statusCode: 429, retryable: true },
    "error-500": { kind: "error", statusCode: 500, retryable: true },
    "error-529": { kind: "error", statusCode: 529, retryable: true },
  },
  openai: {
    ok: TEXT,
    long: TEXT,
    "max-tokens": TEXT,
    slow: TEXT,
    drop: { kind: "truncated" },
    "error-401": { kind: "error", statusCode: 401, retryable: false },
    "error-429": { kind: "error", statusCode: 429, retryable: true },
    "error-500": { kind: "error", statusCode: 500, retryable: true },
    "error-503": { kind: "error", statusCode: 503, retryable: true },
  },
};

const MODELS: Record<ProviderName, string> = { anthropic: "claude-sonnet-4-5", openai: "gpt-4o" };

let server: Server;
let baseUrl = "";
let registered: Array<{ mock: string; name: string }> = [];
const fixtures: Record<ProviderName, string[]> = { anthropic: [], openai: [] };

beforeAll(async () => {
  const config = loadConfig({ MOCK_DATASET: "empty", TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "8" });
  const { app } = createApp(config);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const res = await fetch(`${baseUrl}/__admin/scenarios`);
  registered = ((await res.json()) as { scenarios: Array<{ mock: string; name: string }> }).scenarios;
  for (const provider of ["anthropic", "openai"] as const) {
    const names = await readdir(join(fixturesDir(config), provider)).catch(() => []);
    fixtures[provider] = names.filter((name) => name.endsWith(".sse")).map((name) => name.replace(/\.sse$/, ""));
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function providerOf(name: ProviderName): LlmProvider {
  // Same call the service makes when ANTHROPIC_BASE_URL / OPENAI_BASE_URL point at the mock.
  return name === "anthropic"
    ? new AnthropicProvider({ baseUrl: `${baseUrl}/anthropic` })
    : new OpenAiProvider({ baseUrl: `${baseUrl}/openai` });
}

async function run(name: ProviderName, scenario: string): Promise<{ chunks: LlmStreamChunk[]; error?: unknown }> {
  const chunks: LlmStreamChunk[] = [];
  try {
    for await (const chunk of providerOf(name).sendMessage({
      messages: [{ role: "user", content: "hello" }],
      model: `${MODELS[name]}@${scenario}`,
      apiKey: "mock-key",
      reasoning: scenario === "thinking",
      webFetch: scenario === "web-fetch" || scenario === "pause-turn" || scenario === "inject-obey",
    })) {
      chunks.push(chunk);
    }
    return { chunks };
  } catch (error) {
    return { chunks, error };
  }
}

describe.each(["anthropic", "openai"] as const)("%s adapter against the LLM mock", (name) => {
  it("has an expectation for every scenario the mock registers", () => {
    const names = registered.filter((s) => s.mock === name && !s.name.startsWith(REPLAY_PREFIX)).map((s) => s.name);
    const known = Object.keys(EXPECTED[name]);
    expect(names.filter((n) => !known.includes(n)), "new scenario without a contract expectation").toEqual([]);
    expect(known.filter((n) => !names.includes(n)), "expectation for a scenario the mock no longer has").toEqual([]);
  });

  for (const [scenario, outcome] of Object.entries(EXPECTED[name])) {
    it(`parses the "${scenario}" scenario`, { timeout: 15_000 }, async () => {
      const { chunks, error } = await run(name, scenario);
      const text = chunks.filter((c): c is string => typeof c === "string").join("");
      switch (outcome.kind) {
        case "text":
          expect(error).toBeUndefined();
          expect(text.length).toBeGreaterThan(0);
          break;
        case "reasoning":
          expect(error).toBeUndefined();
          expect(chunks.some((c) => typeof c === "object" && c.type === "reasoning")).toBe(true);
          expect(text.length).toBeGreaterThan(0);
          break;
        case "web_fetch":
          expect(error).toBeUndefined();
          expect(chunks.some((c) => typeof c === "object" && c.type === "web_fetch" && c.status === "done")).toBe(true);
          expect(text.length).toBeGreaterThan(0);
          break;
        case "error":
          expect(error).toBeInstanceOf(ProviderError);
          expect((error as ProviderError).statusCode).toBe(outcome.statusCode);
          expect((error as ProviderError).retryable).toBe(outcome.retryable);
          break;
        case "truncated":
          expect(error).toBeDefined();
          break;
      }
    });
  }

  it("parses every recorded fixture the replay scenario serves", async () => {
    expect(fixtures[name].length).toBeGreaterThan(0);
    for (const fixture of fixtures[name]) {
      const { error } = await run(name, `${REPLAY_PREFIX}${fixture}`);
      // A replay ends in text or in a ProviderError (HTTP errors, errors in the middle of the stream); any other failure is a parsing bug.
      if (error !== undefined) expect(error, `fixture ${fixture}`).toBeInstanceOf(ProviderError);
    }
  });
});
