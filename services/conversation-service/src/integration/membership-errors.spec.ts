/** Membership operations answer with clear 4xx errors (AICHAT-76), through the whole app. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";

async function sharedChat() {
  const t = buildTestApp();
  const chatId = await createChatVia(t.app, "owner");
  await inviteVia(t.app, "owner", chatId, "guest@example.com");
  return { ...t, chatId };
}

describe("POST /chats/:id/members errors", () => {
  it("400 CANNOT_INVITE_SELF when the owner invites their own email", async () => {
    const { app, chatId } = await sharedChat();
    const res = await request(app).post(`/chats/${chatId}/members`).set("Cookie", cookieFor("owner")).send({ email: "Owner@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_INVITE_SELF");
  });

  it("409 ALREADY_A_MEMBER when the email was already invited", async () => {
    const { app, chatId } = await sharedChat();
    const res = await request(app).post(`/chats/${chatId}/members`).set("Cookie", cookieFor("owner")).send({ email: "guest@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_A_MEMBER");
  });

  it("404 CHAT_NOT_FOUND for a non-owner: a member and a stranger cannot invite", async () => {
    const { app, chatId } = await sharedChat();
    for (const userId of ["guest", "stranger"]) {
      const res = await request(app).post(`/chats/${chatId}/members`).set("Cookie", cookieFor(userId)).send({ email: "new@example.com" });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CHAT_NOT_FOUND");
    }
  });
});

describe("DELETE /chats/:id/members/:email errors", () => {
  it("403 FORBIDDEN when a member removes someone other than themselves", async () => {
    const { app, chatId } = await sharedChat();
    const res = await request(app)
      .delete(`/chats/${chatId}/members/${encodeURIComponent("owner@example.com")}`)
      .set("Cookie", cookieFor("guest"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("404 MEMBER_NOT_FOUND when the owner removes an email that is not a member", async () => {
    const { app, chatId } = await sharedChat();
    const res = await request(app)
      .delete(`/chats/${chatId}/members/${encodeURIComponent("ghost@example.com")}`)
      .set("Cookie", cookieFor("owner"));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MEMBER_NOT_FOUND");
  });

  it("404 CHAT_NOT_FOUND for a user who is not in the chat at all", async () => {
    const { app, chatId } = await sharedChat();
    const res = await request(app)
      .delete(`/chats/${chatId}/members/${encodeURIComponent("guest@example.com")}`)
      .set("Cookie", cookieFor("stranger"));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CHAT_NOT_FOUND");
  });
});

describe("DELETE /chats/:id/membership errors", () => {
  it("404 CHAT_NOT_FOUND when the caller is not a member", async () => {
    const { app, chatId } = await sharedChat();
    const res = await request(app).delete(`/chats/${chatId}/membership`).set("Cookie", cookieFor("stranger"));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CHAT_NOT_FOUND");
  });

  it("404 MEMBER_NOT_FOUND when the owner tries to leave their own chat (owners delete instead)", async () => {
    const { app, chatId } = await sharedChat();
    const res = await request(app).delete(`/chats/${chatId}/membership`).set("Cookie", cookieFor("owner"));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MEMBER_NOT_FOUND");
  });
});

describe("GET /chats/:id/members errors", () => {
  it("404 CHAT_NOT_FOUND for a user who is not in the chat", async () => {
    const { app, chatId } = await sharedChat();
    const res = await request(app).get(`/chats/${chatId}/members`).set("Cookie", cookieFor("stranger"));
    expect(res.status).toBe(404);
  });
});
