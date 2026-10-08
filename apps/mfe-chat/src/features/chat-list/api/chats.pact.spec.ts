import { eachLike, errorResponseMatcher, newConsumerPact, runWithMockServer } from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { CHAT_ID, chatBody, correlation, jsonRequest } from "../../../test/pact";
import { createChat, deleteChat, fetchChat, fetchChats, updateChat } from "./chats";

// Contract mfe-chat -> conversation-service: chats (AICHAT-179). Requests go through the
// shell's `/api` proxy, which removes the prefix; the provider sees `/chats`.
const pact = newConsumerPact("mfe-chat", "conversation-service");
const run = <T>(call: () => Promise<T>) => runWithMockServer(pact, call, { stripPrefix: "/api" });
const owner = { chatId: CHAT_ID };

describe("mfe-chat -> conversation-service: chats", () => {
  it("GET /chats lists the user's chats", async () => {
    pact
      .given("a user owns a chat", owner)
      .uponReceiving("a request for the chat list")
      .withRequest({ method: "GET", path: "/chats", headers: correlation })
      .willRespondWith({ status: 200, headers: correlation, body: { chats: eachLike(chatBody) } });

    const chats = await run(() => fetchChats());

    expect(chats).toHaveLength(1);
    expect(chats[0]).toMatchObject({ id: CHAT_ID, provider: "anthropic" });
  });

  it("POST /chats creates a chat with the chosen provider and model (201)", async () => {
    const input = { title: "Trip plan", provider: "anthropic" as const, model: "claude-haiku-4-5" };
    pact
      .given("a user is signed in")
      .uponReceiving("a request to create a chat")
      .withRequest({ method: "POST", path: "/chats", headers: jsonRequest, body: input })
      .willRespondWith({ status: 201, headers: correlation, body: { chat: chatBody } });

    await expect(run(() => createChat(input))).resolves.toMatchObject({ id: CHAT_ID, model: "claude-haiku-4-5" });
  });

  it("GET /chats/:id returns one chat", async () => {
    pact
      .given("a user owns a chat", owner)
      .uponReceiving("a request for one chat")
      .withRequest({ method: "GET", path: `/chats/${CHAT_ID}`, headers: correlation })
      .willRespondWith({ status: 200, headers: correlation, body: { chat: chatBody } });

    await expect(run(() => fetchChat(CHAT_ID))).resolves.toMatchObject({ id: CHAT_ID });
  });

  it("GET /chats/:id of a chat the user cannot see is a 404 with the server's message", async () => {
    pact
      .given("the chat does not exist", owner)
      .uponReceiving("a request for a chat that does not exist")
      .withRequest({ method: "GET", path: `/chats/${CHAT_ID}`, headers: correlation })
      .willRespondWith({ status: 404, headers: correlation, body: errorResponseMatcher({ code: "CHAT_NOT_FOUND" }) });

    // useChat stops retrying on 404 and the page shows "not found" (AC-46).
    await expect(run(() => fetchChat(CHAT_ID))).rejects.toMatchObject({
      status: 404,
      code: "CHAT_NOT_FOUND",
      message: "A human-readable error message.",
    });
  });

  it("PATCH /chats/:id renames the chat", async () => {
    pact
      .given("a user owns a chat", owner)
      .uponReceiving("a request to rename a chat")
      .withRequest({ method: "PATCH", path: `/chats/${CHAT_ID}`, headers: jsonRequest, body: { title: "New title" } })
      .willRespondWith({ status: 200, headers: correlation, body: { chat: chatBody } });

    await expect(run(() => updateChat({ chatId: CHAT_ID, title: "New title" }))).resolves.toMatchObject({ id: CHAT_ID });
  });

  it("DELETE /chats/:id answers 204", async () => {
    pact
      .given("a user owns a chat", owner)
      .uponReceiving("a request to delete a chat")
      .withRequest({ method: "DELETE", path: `/chats/${CHAT_ID}`, headers: correlation })
      .willRespondWith({ status: 204, headers: correlation });

    await expect(run(() => deleteChat(CHAT_ID))).resolves.toBeUndefined();
  });
});
