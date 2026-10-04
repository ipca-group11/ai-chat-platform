/** Shared chats open only for a verified owner of the invited address (AICHAT-253, pentest H1),
 * through the whole app with real signed tokens. */
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor, TEST_JWT_SECRET } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";

async function sharedChat() {
  const t = buildTestApp();
  const chatId = await createChatVia(t.app, "owner");
  await inviteVia(t.app, "owner", chatId, "victim@example.com");
  return { ...t, chatId };
}

describe("chat shared by email (pentest H1)", () => {
  it("an attacker who registered the invited address without verifying it gets 404 on every member route", async () => {
    const { app, chatId } = await sharedChat();
    const attacker = cookieFor("attacker", { email: "victim@example.com", emailVerified: false });

    expect((await request(app).get(`/chats/${chatId}`).set("Cookie", attacker)).status).toBe(404);
    expect((await request(app).get(`/chats/${chatId}/messages`).set("Cookie", attacker)).status).toBe(404);
    expect((await request(app).get(`/chats/${chatId}/members`).set("Cookie", attacker)).status).toBe(404);
    expect((await request(app).post(`/chats/${chatId}/messages`).set("Cookie", attacker).send({ content: "hi" })).status).toBe(404);
    const list = await request(app).get("/chats").set("Cookie", attacker);
    expect(list.status).toBe(200);
    expect(list.body.chats).toEqual([]);
  });

  it("a token issued before email verification existed (no email_verified claim) counts as unverified", async () => {
    const { app, chatId } = await sharedChat();
    const legacy = jwt.sign({ sub: "attacker", email: "victim@example.com" }, TEST_JWT_SECRET, { expiresIn: "15m" });
    expect((await request(app).get(`/chats/${chatId}`).set("Cookie", `access_token=${legacy}`)).status).toBe(404);
  });

  it("the verified owner of the address opens it, and from then on it is theirs alone", async () => {
    const { app, chatId } = await sharedChat();
    const victim = cookieFor("victim", { email: "victim@example.com" });
    expect((await request(app).get(`/chats/${chatId}`).set("Cookie", victim)).status).toBe(200);

    // Even a verified token for the same address but another account no longer matches.
    const other = cookieFor("someone-else", { email: "victim@example.com" });
    expect((await request(app).get(`/chats/${chatId}`).set("Cookie", other)).status).toBe(404);
  });

  it("a member who leaves loses access, and the invite is not claimable again", async () => {
    const { app, chatId } = await sharedChat();
    const victim = cookieFor("victim", { email: "victim@example.com" });
    expect((await request(app).get(`/chats/${chatId}`).set("Cookie", victim)).status).toBe(200);
    expect((await request(app).delete(`/chats/${chatId}/membership`).set("Cookie", victim)).status).toBe(204);
    expect((await request(app).get(`/chats/${chatId}`).set("Cookie", victim)).status).toBe(404);
  });
});
