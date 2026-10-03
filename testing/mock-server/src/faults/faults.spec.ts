import { get } from "node:http";
import type { AddressInfo } from "node:net";
import { http } from "@app/shared-types";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { MOCK_PASSWORD } from "../data/factories.js";
import { FaultStore, routeMatches, STREAM_DROP_AFTER_EVENTS } from "./faults.js";

function setup(env: NodeJS.ProcessEnv = {}) {
  return createApp(loadConfig({ MOCK_DATASET: "default", TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", ...env }));
}

async function signIn(app: ReturnType<typeof setup>["app"]) {
  const login = await request(app).post("/auth/login").send({ email: "alice@mock.test", password: MOCK_PASSWORD });
  return (login.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
}

describe("routeMatches", () => {
  it.each([
    ["GET /auth/me", "GET", "/auth/me", true],
    ["GET /auth/me", "POST", "/auth/me", false],
    ["* /auth/me", "DELETE", "/auth/me", true],
    ["GET /api/chats/:id/stream", "GET", "/api/chats/chat_00001/stream", true],
    ["GET /api/chats/:id/stream", "GET", "/api/chats/chat_00001/messages", false],
    ["GET /api/chats/*", "GET", "/api/chats/chat_00001/stream", true],
    ["* /api/*", "POST", "/api/chats", true],
    ["GET /api/chats", "GET", "/api/chats/chat_00001", false],
    ["GET /api/chats/chat_00001", "GET", "/api/chats", false],
    ["GET /api/chats/x/y", "GET", "/api/chats/x", false],
  ])("%s vs %s %s -> %s", (pattern, method, path, expected) => {
    expect(routeMatches(pattern, method, path)).toBe(expected);
  });
});

describe("FaultStore", () => {
  it("replaces a fault on the same route, counts down times and clears by route", () => {
    const store = new FaultStore();
    store.set({ route: "GET /auth/me", scenario: "error-500" });
    store.set({ route: "GET /auth/me", scenario: "session-expired", times: 2 });
    store.set({ route: "POST /auth/login", scenario: "slow", delayMs: 5 });
    expect(store.list()).toEqual([
      { route: "GET /auth/me", scenario: "session-expired", times: 2 },
      { route: "POST /auth/login", scenario: "slow", delayMs: 5 },
    ]);

    expect(store.take("GET", "/auth/me")?.scenario).toBe("session-expired");
    expect(store.take("GET", "/auth/me")?.scenario).toBe("session-expired");
    expect(store.take("GET", "/auth/me")).toBeUndefined();
    expect(store.clear("POST /auth/login")).toBe(1);
    expect(store.clear()).toBe(0);
  });
});

describe("/__admin/faults", () => {
  it("sets, lists and clears faults, and rejects a bad one", async () => {
    const { app } = setup();
    const created = await request(app).post("/__admin/faults").send({ route: "GET /auth/me", scenario: "error-500" });
    expect(created.status).toBe(201);
    expect(created.body.faults).toEqual([{ route: "GET /auth/me", scenario: "error-500" }]);

    const listed = await request(app).get("/__admin/faults");
    expect(listed.body.scenarios).toEqual(["session-expired", "error-500", "slow", "stream-drop"]);
    expect(listed.body.faults).toHaveLength(1);

    const bad = await request(app).post("/__admin/faults").send({ route: "me", scenario: "boom" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("invalid_fault");

    const cleared = await request(app).delete("/__admin/faults").query({ route: "GET /auth/me" });
    expect(cleared.body).toEqual({ removed: 1, faults: [] });
  });

  it("is cleared by /__admin/reset", async () => {
    const { app } = setup();
    await request(app).post("/__admin/faults").send({ route: "* /auth/*", scenario: "error-500" });
    await request(app).post("/__admin/reset");
    expect((await request(app).get("/__admin/faults")).body.faults).toEqual([]);
    expect((await request(app).get("/auth/me")).status).toBe(401);
  });
});

describe("auth faults", () => {
  it("session-expired answers 401 on the next call only (times: 1) and clears the cookies", async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ email: "alice@mock.test", password: MOCK_PASSWORD });
    await agent.post("/__admin/faults").send({ route: "GET /auth/me", scenario: "session-expired", times: 1 });

    const expired = await agent.get("/auth/me");
    expect(expired.status).toBe(401);
    expect(expired.headers["x-mock-fault"]).toBe("session-expired");
    expect(http.errorResponseSchema.parse(expired.body).error.code).toBe("UNAUTHENTICATED");
    expect((expired.headers["set-cookie"] as unknown as string[]).join("\n")).toMatch(/access_token=;/);
  });

  it("session-expired set without times keeps failing until it is cleared", async () => {
    const { app } = setup();
    await request(app).post("/__admin/faults").send({ route: "GET /auth/me", scenario: "session-expired" });
    expect((await request(app).get("/auth/me")).status).toBe(401);
    expect((await request(app).get("/auth/me")).headers["x-mock-fault"]).toBe("session-expired");
    await request(app).delete("/__admin/faults");
    expect((await request(app).get("/auth/me")).headers["x-mock-fault"]).toBeUndefined();
  });

  it("error-500 by header answers the service's 500 body for that request only", async () => {
    const { app } = setup();
    const res = await request(app).post("/auth/login").set("X-Mock-Scenario", "error-500").send({});
    expect(res.status).toBe(500);
    expect(http.errorResponseSchema.parse(res.body).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    expect((await request(app).post("/auth/login").send({})).status).toBe(401);
  });

  it("slow holds the answer back for delayMs", async () => {
    const { app } = setup();
    await request(app).post("/__admin/faults").send({ route: "POST /auth/login", scenario: "slow", delayMs: 120 });
    const started = Date.now();
    const res = await request(app).post("/auth/login").send({ email: "alice@mock.test", password: MOCK_PASSWORD });
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(110);
  });

  it("ignores a scenario header that is not a fault name", async () => {
    const { app } = setup();
    const res = await request(app).get("/auth/me").set("X-Mock-Scenario", "ok");
    expect(res.status).toBe(401);
    expect(res.headers["x-mock-fault"]).toBeUndefined();
  });
});

describe("conversation faults", () => {
  it("applies per route: only the faulted route fails", async () => {
    const { app } = setup();
    const cookie = await signIn(app);
    await request(app).post("/__admin/faults").send({ route: "GET /api/chats", scenario: "error-500" });
    const failed = await request(app).get("/api/chats").set("Cookie", cookie);
    expect(failed.status).toBe(500);
    expect(http.errorResponseSchema.parse(failed.body).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
    expect((await request(app).get("/api/chats/chat_00001").set("Cookie", cookie)).status).toBe(200);
  });

  it("session-expired answers the conversation-service 401", async () => {
    const { app } = setup();
    const cookie = await signIn(app);
    const res = await request(app).get("/api/chats").set("Cookie", cookie).set("X-Mock-Scenario", "session-expired");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Missing or invalid access token");
  });

  it("slow by header uses the default delay unless the fault sets one", async () => {
    const { app } = setup();
    const cookie = await signIn(app);
    await request(app).post("/__admin/faults").send({ route: "GET /api/chats", scenario: "slow", delayMs: 80 });
    const started = Date.now();
    expect((await request(app).get("/api/chats").set("Cookie", cookie)).status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
  });

  it("stream-drop cuts the chat stream after a few events", async () => {
    const { app } = setup({ TOKENS: "20" });
    const cookie = await signIn(app);
    await request(app).post("/__admin/faults").send({ route: "GET /api/chats/:id/stream", scenario: "stream-drop" });

    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    const received: string[] = [];
    const closed = new Promise<void>((resolve) => {
      get({ port, path: "/api/chats/chat_00001/stream", headers: { Cookie: cookie } }, (res) => {
        expect(res.headers["x-mock-fault"]).toBe("stream-drop");
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => received.push(chunk));
        res.on("close", resolve);
        res.on("error", () => undefined);
      }).on("error", () => resolve());
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await request(app).post("/api/chats/chat_00001/messages").set("Cookie", cookie).send({ content: "go" });
    await closed;
    server.closeAllConnections();
    server.close();

    const events = received.join("").split("\n\n").filter(Boolean);
    expect(events).toHaveLength(STREAM_DROP_AFTER_EVENTS);
    expect(events.at(-1)).toMatch(/^event: token/);
  });
});
