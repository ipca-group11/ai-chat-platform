import { eachLike, errorResponseMatcher, newConsumerPact, runWithMockServer } from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { CHAT_ID, correlation, jsonRequest, memberBody } from "../../../test/pact";
import { addChatMember, fetchChatMembers, leaveChat, removeChatMember } from "./members";

// Contract mfe-chat -> conversation-service: chat members (AICHAT-179).
const pact = newConsumerPact("mfe-chat", "conversation-service");
const run = <T>(call: () => Promise<T>) => runWithMockServer(pact, call, { stripPrefix: "/api" });
const MEMBER = "bob@example.com";

describe("mfe-chat -> conversation-service: members", () => {
  it("GET /chats/:id/members lists owner and members", async () => {
    pact
      .given("a user owns a chat with a member", { chatId: CHAT_ID, email: MEMBER })
      .uponReceiving("a request for the members of a chat")
      .withRequest({ method: "GET", path: `/chats/${CHAT_ID}/members`, headers: correlation })
      .willRespondWith({ status: 200, headers: correlation, body: { members: eachLike(memberBody) } });

    await expect(run(() => fetchChatMembers(CHAT_ID))).resolves.toEqual([
      { email: MEMBER, role: "member", addedAt: "2026-10-08T10:00:00.000Z" },
    ]);
  });

  it("POST /chats/:id/members invites by email (201)", async () => {
    pact
      .given("a user owns a chat", { chatId: CHAT_ID })
      .uponReceiving("a request to invite a member")
      .withRequest({ method: "POST", path: `/chats/${CHAT_ID}/members`, headers: jsonRequest, body: { email: MEMBER } })
      .willRespondWith({ status: 201, headers: correlation, body: { member: memberBody } });

    await expect(run(() => addChatMember(CHAT_ID, MEMBER))).resolves.toMatchObject({ email: MEMBER, role: "member" });
  });

  it("POST /chats/:id/members for someone already in the chat is a 409 shown in the dialog", async () => {
    pact
      .given("a user owns a chat with a member", { chatId: CHAT_ID, email: MEMBER })
      .uponReceiving("a request to invite someone who is already a member")
      .withRequest({ method: "POST", path: `/chats/${CHAT_ID}/members`, headers: jsonRequest, body: { email: MEMBER } })
      .willRespondWith({ status: 409, headers: correlation, body: errorResponseMatcher({ code: "ALREADY_A_MEMBER" }) });

    await expect(run(() => addChatMember(CHAT_ID, MEMBER))).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_A_MEMBER",
      message: "A human-readable error message.",
    });
  });

  it("DELETE /chats/:id/members/:email removes a member (204)", async () => {
    pact
      .given("a user owns a chat with a member", { chatId: CHAT_ID, email: MEMBER })
      .uponReceiving("a request to remove a member")
      .withRequest({ method: "DELETE", path: `/chats/${CHAT_ID}/members/${encodeURIComponent(MEMBER)}`, headers: correlation })
      .willRespondWith({ status: 204, headers: correlation });

    await expect(run(() => removeChatMember(CHAT_ID, MEMBER))).resolves.toBeUndefined();
  });

  it("DELETE /chats/:id/membership lets a member leave (204)", async () => {
    pact
      .given("a user is a member of a chat", { chatId: CHAT_ID })
      .uponReceiving("a request to leave a shared chat")
      .withRequest({ method: "DELETE", path: `/chats/${CHAT_ID}/membership`, headers: correlation })
      .willRespondWith({ status: 204, headers: correlation });

    await expect(run(() => leaveChat(CHAT_ID))).resolves.toBeUndefined();
  });
});
