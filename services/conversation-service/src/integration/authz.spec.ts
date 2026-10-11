/**
 * NFR sec-authz-idor: authentication and object-level authorization through the whole app.
 * Threshold: expired / tampered / alg=none / wrong-secret JWT -> 401 on every protected
 * route; another user's chat -> 403/404; zero leaks of the owner's data in any response.
 * Run: pnpm nx test conversation-service -- authz
 */
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { listRoutes } from "../test-utils/route-inventory.js";
import { cookieFor, TEST_JWT_SECRET, tokenFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";

const SECRET_TEXT = "TOP-SECRET-OWNER-PAYLOAD-7f3a";
const SECRET_TITLE = "OWNER-PRIVATE-TITLE-91bc";

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

function badTokens(): Record<string, string> {
  const valid = tokenFor("owner");
  const [header, payload, signature] = valid.split(".") as [string, string, string];
  const forgedPayload = b64({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), sub: "victim" });
  const now = Math.floor(Date.now() / 1000);
  return {
    expired: jwt.sign({ sub: "owner", email: "owner@example.com" }, TEST_JWT_SECRET, { expiresIn: -60 }),
    expiredByClaim: jwt.sign({ sub: "owner", email: "owner@example.com", iat: now - 7200, exp: now - 3600 }, TEST_JWT_SECRET),
    tamperedPayload: `${header}.${forgedPayload}.${signature}`,
    tamperedSignature: `${header}.${payload}.${signature.slice(0, -4)}AAAA`,
    wrongSecret: tokenFor("owner", "not-the-secret"),
    algNone: `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "owner", email: "owner@example.com", iat: now, exp: now + 900 })}.`,
    algNoneUpper: `${b64({ alg: "NONE", typ: "JWT" })}.${b64({ sub: "owner", email: "owner@example.com", iat: now, exp: now + 900 })}.`,
    algHS512: jwt.sign({ sub: "owner", email: "owner@example.com" }, TEST_JWT_SECRET, { algorithm: "HS512", expiresIn: "15m" }),
    missingEmailClaim: jwt.sign({ sub: "owner" }, TEST_JWT_SECRET, { expiresIn: "15m" }),
    garbage: "not.a.jwt",
    empty: "x",
  };
}

async function seeded() {
  const t = buildTestApp();
  const chatId = await createChatVia(t.app, "owner", { title: SECRET_TITLE });
  const sent = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("owner")).send({ content: SECRET_TEXT });
  expect(sent.status).toBe(201);
  const messageId = (sent.body as { message: { id: string } }).message.id;
  return { ...t, chatId, messageId };
}

function expectNoLeak(res: request.Response): void {
  const dump = `${res.text ?? ""}${JSON.stringify(res.body ?? {})}`;
  expect(dump).not.toContain(SECRET_TEXT);
  expect(dump).not.toContain(SECRET_TITLE);
  expect(dump).not.toContain("owner@example.com");
}

/** Every protected route as [method, path-builder, body]. */
function protectedCalls(chatId: string, messageId: string): { name: string; method: "get" | "post" | "patch" | "delete"; path: string; body?: object }[] {
  return [
    { name: "GET /chats", method: "get", path: "/chats" },
    { name: "POST /chats", method: "post", path: "/chats", body: { title: "x", provider: "anthropic", model: "claude-haiku-4-5" } },
    { name: "GET /chats/:id", method: "get", path: `/chats/${chatId}` },
    { name: "PATCH /chats/:id", method: "patch", path: `/chats/${chatId}`, body: { title: "pwned" } },
    { name: "DELETE /chats/:id", method: "delete", path: `/chats/${chatId}` },
    { name: "GET /chats/:id/members", method: "get", path: `/chats/${chatId}/members` },
    { name: "POST /chats/:id/members", method: "post", path: `/chats/${chatId}/members`, body: { email: "evil@example.com" } },
    { name: "DELETE /chats/:id/members/:email", method: "delete", path: `/chats/${chatId}/members/owner%40example.com` },
    { name: "DELETE /chats/:id/membership", method: "delete", path: `/chats/${chatId}/membership` },
    { name: "GET /chats/:chatId/messages", method: "get", path: `/chats/${chatId}/messages` },
    { name: "POST /chats/:chatId/messages", method: "post", path: `/chats/${chatId}/messages`, body: { content: "injected" } },
    { name: "PATCH /chats/:chatId/messages/:messageId", method: "patch", path: `/chats/${chatId}/messages/${messageId}`, body: { content: "edited" } },
    { name: "DELETE /chats/:chatId/messages/:messageId", method: "delete", path: `/chats/${chatId}/messages/${messageId}` },
    { name: "POST /chats/:chatId/messages/:messageId/retry", method: "post", path: `/chats/${chatId}/messages/${messageId}/retry` },
    { name: "POST /chats/:chatId/stop", method: "post", path: `/chats/${chatId}/stop` },
    { name: "GET /chats/:chatId/stream", method: "get", path: `/chats/${chatId}/stream` },
    { name: "POST /chats/:chatId/messages/:messageId/attachments", method: "post", path: `/chats/${chatId}/messages/${messageId}/attachments` },
  ];
}

describe("authn: invalid tokens are rejected with 401 on every protected route", () => {
  it("covers every registered route except the public ones and the service-token route", () => {
    const covered = new Set(protectedCalls("c", "m").map((c) => c.name));
    const registered = listRoutes(buildTestApp().app).filter((r) => !["GET /health", "GET /metrics", "POST /internal/erasures"].includes(r));
    expect(registered.filter((r) => !covered.has(r)), "protected routes not probed by authz.spec").toEqual([]);
  });

  it("no token -> 401 on every protected route, with no data in the body", async () => {
    const t = await seeded();
    for (const call of protectedCalls(t.chatId, t.messageId)) {
      const res = await request(t.app)[call.method](call.path).send(call.body);
      expect(res.status, call.name).toBe(401);
      expectNoLeak(res);
    }
  });

  for (const [label, token] of Object.entries(badTokens())) {
    it(`${label} token -> 401 (cookie and Bearer) on every protected route`, async () => {
      const t = await seeded();
      for (const call of protectedCalls(t.chatId, t.messageId)) {
        const viaCookie = await request(t.app)[call.method](call.path).set("Cookie", [`access_token=${token}`]).send(call.body);
        expect(viaCookie.status, `${call.name} (cookie)`).toBe(401);
        expectNoLeak(viaCookie);
        const viaBearer = await request(t.app)[call.method](call.path).set("Authorization", `Bearer ${token}`).send(call.body);
        expect(viaBearer.status, `${call.name} (bearer)`).toBe(401);
        expectNoLeak(viaBearer);
      }
    });
  }

  it("a tampered token that claims the owner's identity never reads the owner's chat", async () => {
    const t = await seeded();
    const { tamperedPayload, algNone } = badTokens();
    for (const token of [tamperedPayload, algNone]) {
      const res = await request(t.app).get(`/chats/${t.chatId}/messages`).set("Cookie", [`access_token=${token}`]);
      expect(res.status).toBe(401);
      expectNoLeak(res);
    }
  });

  it("a valid token still works (control: the 401s above are not a broken app)", async () => {
    const t = await seeded();
    const res = await request(t.app).get(`/chats/${t.chatId}/messages`).set("Cookie", cookieFor("owner"));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(SECRET_TEXT);
  });
});

describe("authz / IDOR: another user's chat is never readable or writable", () => {
  it("a stranger gets 403 or 404 and no owner data on every chat-scoped route", async () => {
    const t = await seeded();
    for (const call of protectedCalls(t.chatId, t.messageId).filter((c) => c.path.includes(t.chatId))) {
      const res = await request(t.app)[call.method](call.path).set("Cookie", cookieFor("stranger")).send(call.body);
      expect([403, 404], `${call.name} answered ${res.status}`).toContain(res.status);
      expectNoLeak(res);
    }
  });

  it("the stranger's attempts changed nothing: the owner's chat and message are intact", async () => {
    const t = await seeded();
    for (const call of protectedCalls(t.chatId, t.messageId).filter((c) => c.path.includes(t.chatId))) {
      await request(t.app)[call.method](call.path).set("Cookie", cookieFor("stranger")).send(call.body);
    }
    const chat = await request(t.app).get(`/chats/${t.chatId}`).set("Cookie", cookieFor("owner"));
    expect(chat.status).toBe(200);
    expect(chat.body.chat.title).toBe(SECRET_TITLE);
    const messages = await request(t.app).get(`/chats/${t.chatId}/messages`).set("Cookie", cookieFor("owner"));
    const list = (messages.body as { messages: { content: string }[] }).messages;
    expect(list.map((m) => m.content)).toEqual([SECRET_TEXT]);
  });

  it("GET /chats lists only the caller's chats", async () => {
    const t = await seeded();
    const res = await request(t.app).get("/chats").set("Cookie", cookieFor("stranger"));
    expect(res.status).toBe(200);
    expectNoLeak(res);
    expect(res.body.chats).toEqual([]);
  });

  it("a non-existent chat id answers like another user's chat (no existence oracle)", async () => {
    const t = await seeded();
    const real = await request(t.app).get(`/chats/${t.chatId}`).set("Cookie", cookieFor("stranger"));
    const fake = await request(t.app).get("/chats/does-not-exist").set("Cookie", cookieFor("stranger"));
    expect(real.status).toBe(fake.status);
    expect(real.body).toEqual(fake.body);
  });

  it("a stranger cannot reach the chat through a mismatched message id or a path trick", async () => {
    const t = await seeded();
    const other = await createChatVia(t.app, "stranger");
    for (const path of [
      `/chats/${other}/messages/${t.messageId}`,
      `/chats/${other}/../${t.chatId}/messages`,
      `/chats/${t.chatId}%2f..%2f${other}/messages`,
      `/chats/${t.chatId}/`,
    ]) {
      const res = await request(t.app).get(path).set("Cookie", cookieFor("stranger"));
      expect(res.status, path).not.toBe(200);
      expectNoLeak(res);
    }
    const patch = await request(t.app).patch(`/chats/${other}/messages/${t.messageId}`).set("Cookie", cookieFor("stranger")).send({ content: "x" });
    expect([403, 404]).toContain(patch.status);
  });

  it("a stranger cannot grant themselves access by inviting their own email", async () => {
    const t = await seeded();
    const res = await request(t.app).post(`/chats/${t.chatId}/members`).set("Cookie", cookieFor("stranger")).send({ email: "stranger@example.com" });
    expect([403, 404]).toContain(res.status);
    const after = await request(t.app).get(`/chats/${t.chatId}/messages`).set("Cookie", cookieFor("stranger"));
    expect([403, 404]).toContain(after.status);
    expectNoLeak(after);
  });

  it("a forged id header or query cannot impersonate the owner", async () => {
    const t = await seeded();
    const res = await request(t.app)
      .get(`/chats/${t.chatId}/messages?userId=owner&ownerId=owner`)
      .set("Cookie", cookieFor("stranger"))
      .set("X-User-Id", "owner")
      .set("X-Forwarded-User", "owner");
    expect([403, 404]).toContain(res.status);
    expectNoLeak(res);
  });

  it("a removed member loses access immediately", async () => {
    const t = await seeded();
    await request(t.app).post(`/chats/${t.chatId}/members`).set("Cookie", cookieFor("owner")).send({ email: "guest@example.com" }).expect(201);
    expect((await request(t.app).get(`/chats/${t.chatId}/messages`).set("Cookie", cookieFor("guest"))).status).toBe(200);
    await request(t.app).delete(`/chats/${t.chatId}/members/${encodeURIComponent("guest@example.com")}`).set("Cookie", cookieFor("owner")).expect(204);
    const res = await request(t.app).get(`/chats/${t.chatId}/messages`).set("Cookie", cookieFor("guest"));
    expect([403, 404]).toContain(res.status);
    expectNoLeak(res);
  });

  it("a member cannot perform owner-only actions (rename, delete, invite)", async () => {
    const t = await seeded();
    await request(t.app).post(`/chats/${t.chatId}/members`).set("Cookie", cookieFor("owner")).send({ email: "guest@example.com" }).expect(201);
    const guest = cookieFor("guest");
    const patch = await request(t.app).patch(`/chats/${t.chatId}`).set("Cookie", guest).send({ title: "hijack" });
    const del = await request(t.app).delete(`/chats/${t.chatId}`).set("Cookie", guest);
    const invite = await request(t.app).post(`/chats/${t.chatId}/members`).set("Cookie", guest).send({ email: "x@example.com" });
    for (const res of [patch, del, invite]) expect([403, 404]).toContain(res.status);
    const chat = await request(t.app).get(`/chats/${t.chatId}`).set("Cookie", cookieFor("owner"));
    expect(chat.body.chat.title).toBe(SECRET_TITLE);
  });
});

describe("service-token route is not reachable with a user JWT", () => {
  it("POST /internal/erasures rejects a user token and a missing token", async () => {
    const t = await seeded();
    for (const set of [(r: request.Test) => r, (r: request.Test) => r.set("Cookie", cookieFor("owner")), (r: request.Test) => r.set("Authorization", `Bearer ${tokenFor("owner")}`)]) {
      const res = await set(request(t.app).post("/internal/erasures")).send({ userId: "owner" });
      expect([401, 403, 404]).toContain(res.status);
    }
    expect((await request(t.app).get(`/chats/${t.chatId}`).set("Cookie", cookieFor("owner"))).status).toBe(200);
  });
});
