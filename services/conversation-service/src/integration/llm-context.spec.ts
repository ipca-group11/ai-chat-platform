/**
 * What the model receives when a message is sent through the real app (real queue and message processor,
 * in-memory fakes, a scripted provider that records its context).
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { SendMessageContext } from "../features/llm-adapters/index.js";
import { DEFAULT_SYSTEM_PROMPT, UNTRUSTED_CONTENT_RULES } from "../shared/system-prompt.js";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";
import { fakeProviderRegistry, ScriptedProvider } from "../test-utils/fake-provider-registry.js";

/** The app with the real queue, and the contexts the provider was called with. */
function appRecordingContexts(env: Record<string, string> = {}) {
  const contexts: SendMessageContext[] = [];
  const provider = new ScriptedProvider(async function* (context) {
    contexts.push(context);
    yield "ok";
  });
  const t = buildTestApp({ env, overrides: { providerRegistry: fakeProviderRegistry(provider), queueManager: undefined } });
  return { ...t, contexts };
}

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 5));
  if (!check()) throw new Error("timed out");
}

describe("system prompt sent to the model (AICHAT-243)", () => {
  it("is the built-in prompt with the untrusted-content rules by default", async () => {
    const { app, contexts } = appRecordingContexts();
    const chatId = await createChatVia(app, "user-1");
    await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-1")).send({ content: "hi" }).expect(201);
    await until(() => contexts.length === 1);

    expect(contexts[0]?.messages[0]).toEqual({ role: "system", content: DEFAULT_SYSTEM_PROMPT });
  });

  it("keeps the rules after a deployment's own SYSTEM_PROMPT", async () => {
    const { app, contexts } = appRecordingContexts({ SYSTEM_PROMPT: "You are the ACME bot." });
    const chatId = await createChatVia(app, "user-1");
    await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-1")).send({ content: "hi" }).expect(201);
    await until(() => contexts.length === 1);

    expect(contexts[0]?.messages[0]).toEqual({ role: "system", content: `You are the ACME bot.\n\n${UNTRUSTED_CONTENT_RULES}` });
  });
});
