import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { TEST_JWT_SECRET, tokenFor } from "../../test-utils/auth-token.js";
import { authMiddleware } from "../../shared/auth-middleware.js";
import { errorHandler, notFoundHandler } from "../../shared/error-handler.js";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { ChatsService } from "./service.js";
import { createChatsRouter } from "./routes.js";


function buildApp() {
  const service = new ChatsService(new FakeChatsRepository());
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware(TEST_JWT_SECRET));
  app.use("/chats", createChatsRouter(service));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("chats routes", () => {
  it("AC-45: requests without a valid access token are rejected with 401", async () => {
    const app = buildApp();
    const res = await request(app).get("/chats");
    expect(res.status).toBe(401);
  });

  it("AC-42: an authenticated user can create and then list a chat", async () => {
    const app = buildApp();
    const token = tokenFor("user-1");

    const createRes = await request(app)
      .post("/chats")
      .set("Cookie", [`access_token=${token}`])
      .send({ title: "First chat", provider: "ollama", model: "llama3.2:1b" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.chat.title).toBe("First chat");

    const listRes = await request(app).get("/chats").set("Cookie", [`access_token=${token}`]);
    expect(listRes.status).toBe(200);
    expect(listRes.body.chats).toHaveLength(1);
  });

  it("AC-46: user B requesting user A's chat ID receives 403 or 404", async () => {
    const app = buildApp();
    const tokenA = tokenFor("user-a");
    const tokenB = tokenFor("user-b");

    const createRes = await request(app)
      .post("/chats")
      .set("Cookie", [`access_token=${tokenA}`])
      .send({ title: "A's chat", provider: "ollama", model: "llama3.2:1b" });
    const chatId = createRes.body.chat.id as string;

    const getRes = await request(app).get(`/chats/${chatId}`).set("Cookie", [`access_token=${tokenB}`]);
    expect([403, 404]).toContain(getRes.status);

    const deleteRes = await request(app).delete(`/chats/${chatId}`).set("Cookie", [`access_token=${tokenB}`]);
    expect([403, 404]).toContain(deleteRes.status);
  });

  it("AC-44: deleting a chat means it no longer appears or loads", async () => {
    const app = buildApp();
    const token = tokenFor("user-1");
    const createRes = await request(app)
      .post("/chats")
      .set("Cookie", [`access_token=${token}`])
      .send({ title: "Temp", provider: "ollama", model: "llama3.2:1b" });
    const chatId = createRes.body.chat.id as string;

    await request(app).delete(`/chats/${chatId}`).set("Cookie", [`access_token=${token}`]).expect(204);

    const getRes = await request(app).get(`/chats/${chatId}`).set("Cookie", [`access_token=${token}`]);
    expect(getRes.status).toBe(404);

    const listRes = await request(app).get("/chats").set("Cookie", [`access_token=${token}`]);
    expect(listRes.body.chats).toHaveLength(0);
  });

  it("AC-48/AC-49: an authenticated user can rename a chat and change its provider/model", async () => {
    const app = buildApp();
    const token = tokenFor("user-1");
    const createRes = await request(app)
      .post("/chats")
      .set("Cookie", [`access_token=${token}`])
      .send({ title: "Old title", provider: "ollama", model: "llama3.2:1b" });
    const chatId = createRes.body.chat.id as string;

    const updateRes = await request(app)
      .patch(`/chats/${chatId}`)
      .set("Cookie", [`access_token=${token}`])
      .send({ title: "New title", provider: "openai", model: "gpt-4o-mini" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.chat.title).toBe("New title");
    expect(updateRes.body.chat.provider).toBe("openai");
    expect(updateRes.body.chat.model).toBe("gpt-4o-mini");
  });

  it("AC-42: creating a chat with an invalid body is rejected with 400", async () => {
    const app = buildApp();
    const token = tokenFor("user-1");

    const res = await request(app)
      .post("/chats")
      .set("Cookie", [`access_token=${token}`])
      .send({ title: "", provider: "ollama", model: "llama3.2:1b" });

    expect(res.status).toBe(400);
  });

  it("the owner invites a user by email, who can then open the chat and see the members", async () => {
    const app = buildApp();
    const ownerCookie = [`access_token=${tokenFor("owner")}`];
    const guestCookie = [`access_token=${tokenFor("guest")}`];
    const createRes = await request(app)
      .post("/chats")
      .set("Cookie", ownerCookie)
      .send({ title: "Shared", provider: "ollama", model: "llama3.2:1b" });
    const chatId = createRes.body.chat.id as string;

    const inviteRes = await request(app)
      .post(`/chats/${chatId}/members`)
      .set("Cookie", ownerCookie)
      .send({ email: "  Guest@Example.com " });
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.member).toMatchObject({ email: "guest@example.com", role: "member" });

    const getRes = await request(app).get(`/chats/${chatId}`).set("Cookie", guestCookie);
    expect(getRes.status).toBe(200);

    const membersRes = await request(app).get(`/chats/${chatId}/members`).set("Cookie", guestCookie);
    expect(membersRes.body.members).toHaveLength(2);
  });

  it("rejects an invalid invite email with 400", async () => {
    const app = buildApp();
    const cookie = [`access_token=${tokenFor("owner")}`];
    const createRes = await request(app)
      .post("/chats")
      .set("Cookie", cookie)
      .send({ title: "Shared", provider: "ollama", model: "llama3.2:1b" });

    const res = await request(app)
      .post(`/chats/${createRes.body.chat.id as string}/members`)
      .set("Cookie", cookie)
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("a member can leave a chat via DELETE /membership", async () => {
    const app = buildApp();
    const ownerCookie = [`access_token=${tokenFor("owner")}`];
    const guestCookie = [`access_token=${tokenFor("guest")}`];
    const createRes = await request(app)
      .post("/chats")
      .set("Cookie", ownerCookie)
      .send({ title: "Shared", provider: "ollama", model: "llama3.2:1b" });
    const chatId = createRes.body.chat.id as string;
    await request(app).post(`/chats/${chatId}/members`).set("Cookie", ownerCookie).send({ email: "guest@example.com" });

    await request(app)
      .delete(`/chats/${chatId}/membership`)
      .set("Cookie", guestCookie)
      .expect(204);

    const getRes = await request(app).get(`/chats/${chatId}`).set("Cookie", guestCookie);
    expect(getRes.status).toBe(404);
  });

  it("the owner removes a member via DELETE /members/:email", async () => {
    const app = buildApp();
    const ownerCookie = [`access_token=${tokenFor("owner")}`];
    const createRes = await request(app)
      .post("/chats")
      .set("Cookie", ownerCookie)
      .send({ title: "Shared", provider: "ollama", model: "llama3.2:1b" });
    const chatId = createRes.body.chat.id as string;
    await request(app).post(`/chats/${chatId}/members`).set("Cookie", ownerCookie).send({ email: "guest@example.com" });

    await request(app)
      .delete(`/chats/${chatId}/members/${encodeURIComponent("guest@example.com")}`)
      .set("Cookie", ownerCookie)
      .expect(204);

    const getRes = await request(app).get(`/chats/${chatId}`).set("Cookie", [`access_token=${tokenFor("guest")}`]);
    expect(getRes.status).toBe(404);
  });
});
