/**
 * AICHAT-201: a Stop closes the connection to the LLM provider, so nobody pays for tokens nobody reads.
 * The real conversation-service adapters call the LLM mock over real HTTP with real `fetch`; the mock's
 * request log shows whether the client left before the answer was complete (`clientClosedAt`).
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// The adapters are the code under test, so they are imported from their service on purpose.
/* eslint-disable @nx/enforce-module-boundaries */
import { AnthropicProvider } from "../../../../services/conversation-service/src/features/llm-adapters/anthropic.provider.js";
import { OpenAiProvider } from "../../../../services/conversation-service/src/features/llm-adapters/openai.provider.js";
import type { LlmProvider } from "../../../../services/conversation-service/src/features/llm-adapters/types.js";
/* eslint-enable @nx/enforce-module-boundaries */
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";

/** How long after the Stop the provider connection must be closed. */
const CLOSE_WITHIN_MS = 500;
const MODELS = { anthropic: "claude-sonnet-4-5", openai: "gpt-4o" } as const;

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  // A paced answer: "long" is 10 x 40 tokens, 20 ms apart, so it is still streaming when we stop it.
  const { app } = createApp(loadConfig({ MOCK_DATASET: "empty", TTFT_MS: "0", TOKEN_INTERVAL_MS: "20", TOKENS: "40" }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function providerOf(name: keyof typeof MODELS): LlmProvider {
  return name === "anthropic"
    ? new AnthropicProvider({ baseUrl: `${baseUrl}/anthropic` })
    : new OpenAiProvider({ baseUrl: `${baseUrl}/openai` });
}

interface LogEntry {
  path: string;
  finishedAt: string | null;
  clientClosedAt: string | null;
}

async function lastRequest(name: keyof typeof MODELS): Promise<LogEntry> {
  const res = await fetch(`${baseUrl}/__admin/requests?mock=${name}`);
  return ((await res.json()) as { requests: LogEntry[] }).requests.at(-1) as LogEntry;
}

async function waitForEntry(name: keyof typeof MODELS, ok: (e: LogEntry) => boolean): Promise<LogEntry> {
  for (let i = 0; i < 100; i++) {
    const entry = await lastRequest(name);
    if (entry && ok(entry)) return entry;
    await new Promise((r) => setTimeout(r, 10));
  }
  return lastRequest(name);
}

describe.each(["anthropic", "openai"] as const)("%s: Stop closes the provider connection (AICHAT-201)", (name) => {
  it("closes the connection to the provider within the agreed time after Stop", async () => {
    const controller = new AbortController();
    let stoppedAt = 0;
    const chunks: unknown[] = [];

    await expect(
      (async () => {
        for await (const chunk of providerOf(name).sendMessage(
          { messages: [{ role: "user", content: "a long story" }], model: `${MODELS[name]}@long`, apiKey: "mock-key" },
          { signal: controller.signal },
        )) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            stoppedAt = Date.now();
            controller.abort();
          }
        }
      })(),
    ).rejects.toMatchObject({ name: "AbortError" });

    const entry = await waitForEntry(name, (e) => e.clientClosedAt !== null);
    expect(entry.finishedAt, "the provider must not have sent the whole answer").toBeNull();
    expect(entry.clientClosedAt, "the provider never saw the connection close").not.toBeNull();
    expect(Date.parse(entry.clientClosedAt as string) - stoppedAt).toBeLessThan(CLOSE_WITHIN_MS);
  });

  it("without Stop, the provider sends the whole answer (control case)", async () => {
    const chunks: unknown[] = [];
    for await (const chunk of providerOf(name).sendMessage({
      messages: [{ role: "user", content: "hi" }],
      model: `${MODELS[name]}@ok`,
      apiKey: "mock-key",
    })) {
      chunks.push(chunk);
    }

    const entry = await waitForEntry(name, (e) => e.finishedAt !== null);
    expect(chunks.length).toBeGreaterThan(1);
    expect(entry.clientClosedAt).toBeNull();
    expect(entry.finishedAt).not.toBeNull();
  });
});
