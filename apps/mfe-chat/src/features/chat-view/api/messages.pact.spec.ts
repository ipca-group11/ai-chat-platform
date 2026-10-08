import { boolean, eachLike, newConsumerPact, runWithMockServer, term } from "@platform/pact-config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_ID, MESSAGE_ID, correlation, jsonRequest, messageBody } from "../../../test/pact";
import { cancelQueuedMessage, editQueuedMessage, fetchMessages, retryMessage, sendMessage, stopReply } from "./messages";

// Contract mfe-chat -> conversation-service: messages, queue actions and Stop (AICHAT-179).
const pact = newConsumerPact("mfe-chat", "conversation-service");
const run = <T>(call: () => Promise<T>) => runWithMockServer(pact, call, { stripPrefix: "/api" });
const owner = { chatId: CHAT_ID, messageId: MESSAGE_ID };
const user = { userId: "user-1", provider: "anthropic" as const };

// Sending and retrying call the LLM with the user's key, which the browser keeps per tab
// in sessionStorage (`readLlmApiKey`); the provider needs it in `X-Llm-Api-Key`.
const withKey = { ...jsonRequest, "X-Llm-Api-Key": term(".+", "sk-test-key") };

describe("mfe-chat -> conversation-service: messages", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => (key === "llm-api-key-session:user-1:anthropic" ? "sk-test-key" : null) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET /chats/:id/messages returns the history", async () => {
    pact
      .given("a user owns a chat with a message", owner)
      .uponReceiving("a request for the messages of a chat")
      .withRequest({ method: "GET", path: `/chats/${CHAT_ID}/messages`, headers: correlation })
      .willRespondWith({ status: 200, headers: correlation, body: { messages: eachLike(messageBody()) } });

    const messages = await run(() => fetchMessages(CHAT_ID));

    expect(messages[0]).toMatchObject({ id: MESSAGE_ID, role: "user", status: "sent", stopped: false });
  });

  it("POST /chats/:id/messages sends a message with the user's API key (201)", async () => {
    pact
      .given("a user owns a chat", { chatId: CHAT_ID })
      .uponReceiving("a request to send a message")
      .withRequest({ method: "POST", path: `/chats/${CHAT_ID}/messages`, headers: withKey, body: { content: "Hello" } })
      .willRespondWith({ status: 201, headers: correlation, body: { message: messageBody() } });

    await expect(run(() => sendMessage({ chatId: CHAT_ID, content: "Hello", ...user }))).resolves.toMatchObject({ id: MESSAGE_ID });
  });

  it("PATCH /chats/:id/messages/:messageId edits a queued message", async () => {
    pact
      .given("a user owns a chat with a queued message", owner)
      .uponReceiving("a request to edit a queued message")
      .withRequest({
        method: "PATCH",
        path: `/chats/${CHAT_ID}/messages/${MESSAGE_ID}`,
        headers: jsonRequest,
        body: { content: "Edited" },
      })
      .willRespondWith({ status: 200, headers: correlation, body: { message: messageBody({ status: term("queued", "queued") }) } });

    await expect(run(() => editQueuedMessage({ chatId: CHAT_ID, messageId: MESSAGE_ID, content: "Edited" }))).resolves.toMatchObject({
      status: "queued",
    });
  });

  it("DELETE /chats/:id/messages/:messageId cancels a queued message (204)", async () => {
    pact
      .given("a user owns a chat with a queued message", owner)
      .uponReceiving("a request to cancel a queued message")
      .withRequest({ method: "DELETE", path: `/chats/${CHAT_ID}/messages/${MESSAGE_ID}`, headers: correlation })
      .willRespondWith({ status: 204, headers: correlation });

    await expect(run(() => cancelQueuedMessage({ chatId: CHAT_ID, messageId: MESSAGE_ID }))).resolves.toBeUndefined();
  });

  it("POST /chats/:id/messages/:messageId/retry retries a failed reply (202)", async () => {
    pact
      .given("a user owns a chat with a failed reply", owner)
      .uponReceiving("a request to retry a failed reply")
      .withRequest({ method: "POST", path: `/chats/${CHAT_ID}/messages/${MESSAGE_ID}/retry`, headers: { ...correlation, "X-Llm-Api-Key": term(".+", "sk-test-key") } })
      .willRespondWith({ status: 202, headers: correlation, body: { message: messageBody({ role: term("assistant", "assistant") }) } });

    await expect(run(() => retryMessage({ chatId: CHAT_ID, messageId: MESSAGE_ID, ...user }))).resolves.toMatchObject({
      role: "assistant",
    });
  });

  it("POST /chats/:id/stop stops the reply in progress", async () => {
    pact
      .given("a user owns a chat with a reply in progress", { chatId: CHAT_ID })
      .uponReceiving("a request to stop the reply in progress")
      .withRequest({ method: "POST", path: `/chats/${CHAT_ID}/stop`, headers: correlation })
      .willRespondWith({ status: 200, headers: correlation, body: { stopped: boolean(true) } });

    await expect(run(() => stopReply(CHAT_ID))).resolves.toEqual({ stopped: true });
  });
});
