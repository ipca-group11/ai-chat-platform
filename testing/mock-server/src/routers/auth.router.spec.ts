import { auth, http } from "@app/shared-types";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { MOCK_PASSWORD } from "../data/factories.js";

const sessionUser = auth.userProfileSchema.pick({ id: true, email: true });

function setup(dataset = "default") {
  const { app, ctx } = createApp(loadConfig({ MOCK_DATASET: dataset }));
  return { app, ctx, agent: request.agent(app) };
}

const alice = { email: "alice@mock.test", password: MOCK_PASSWORD };

describe("POST /auth/register", () => {
  it("creates the account and answers { id, email } like auth-service", async () => {
    const { app, ctx } = setup("empty");
    const res = await request(app).post("/auth/register").send({ email: "New@Mock.test ", password: "abcdef12" });
    expect(res.status).toBe(201);
    expect(sessionUser.strict().parse(res.body).email).toBe("new@mock.test");
    expect(ctx.store.data.users).toHaveLength(1);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("answers VALIDATION_ERROR with the field errors of the password policy", async () => {
    const { app } = setup();
    const res = await request(app).post("/auth/register").send({ email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    const body = http.errorResponseSchema.parse(res.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid registration details");
    expect(body.error.fieldErrors?.email).toBeDefined();
    expect(body.error.fieldErrors?.password).toContain("Password must be at least 8 characters long");
    expect(body.correlationId).toBeTruthy();
  });

  it("answers 409 EMAIL_TAKEN for an email that exists, whatever its case", async () => {
    const { app } = setup();
    const res = await request(app).post("/auth/register").send({ email: "ALICE@mock.test", password: "abcdef12" });
    expect(res.status).toBe(409);
    const body = http.errorResponseSchema.parse(res.body);
    expect(body.error.code).toBe("EMAIL_TAKEN");
    expect(body.error.fieldErrors).toEqual({ email: ["An account with this email already exists"] });
  });

  it("echoes X-Correlation-Id in the error body", async () => {
    const { app } = setup();
    const res = await request(app).post("/auth/register").set("X-Correlation-Id", "abc-1").send({});
    expect(res.body.correlationId).toBe("abc-1");
  });
});

describe("session", () => {
  it("logs in a seeded user, sets both cookies and serves /me with them", async () => {
    const { agent } = setup();
    const login = await agent.post("/auth/login").send(alice);
    expect(login.status).toBe(200);
    expect(sessionUser.parse(login.body).email).toBe("alice@mock.test");
    const cookies = (login.headers["set-cookie"] as unknown as string[]).join("\n");
    expect(cookies).toMatch(/access_token=[^;]+; Max-Age=900; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Lax/);
    expect(cookies).toMatch(/refresh_token=[^;]+; Max-Age=604800; Path=\/auth; Expires=[^;]+; HttpOnly; SameSite=Lax/);

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual(login.body);
  });

  it("registers then logs in the new account", async () => {
    const { agent } = setup("empty");
    await agent.post("/auth/register").send({ email: "eve@mock.test", password: "abcdef12" });
    const login = await agent.post("/auth/login").send({ email: "eve@mock.test", password: "abcdef12" });
    expect(login.status).toBe(200);
    expect((await agent.get("/auth/me")).body.email).toBe("eve@mock.test");
  });

  it.each([
    ["wrong password", { email: alice.email, password: "nope-1234" }],
    ["unknown email", { email: "ghost@mock.test", password: MOCK_PASSWORD }],
    ["invalid body", { email: "x" }],
  ])("answers the same 401 INVALID_CREDENTIALS for %s", async (_label, body) => {
    const { app } = setup();
    const res = await request(app).post("/auth/login").send(body);
    expect(res.status).toBe(401);
    expect(http.errorResponseSchema.parse(res.body).error).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
  });

  it("answers 401 UNAUTHENTICATED on /me without a session", async () => {
    const { app } = setup();
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(http.errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHENTICATED");
  });

  it("accepts the session as a Bearer token too", async () => {
    const { app } = setup();
    const login = await request(app).post("/auth/login").send(alice);
    const token = /access_token=([^;]+)/.exec((login.headers["set-cookie"] as unknown as string[]).join(";"))?.[1];
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
  });

  it("logs out with 204, clears the cookies and ends the session", async () => {
    const { agent, app } = setup();
    await agent.post("/auth/login").send(alice);
    const token = /access_token=([^;]+)/.exec(
      ((await request(app).post("/auth/login").send(alice)).headers["set-cookie"] as unknown as string[]).join(";"),
    )?.[1];

    const out = await agent.post("/auth/logout");
    expect(out.status).toBe(204);
    expect((out.headers["set-cookie"] as unknown as string[]).join("\n")).toMatch(/access_token=;/);
    expect((await agent.get("/auth/me")).status).toBe(401);
    // the other session is still open
    expect((await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(200);
  });

  it("logout without a session still answers 204", async () => {
    const { app } = setup();
    expect((await request(app).post("/auth/logout")).status).toBe(204);
  });

  it("refresh rotates the session, and rejects a missing refresh token", async () => {
    const { agent, app } = setup();
    expect((await request(app).post("/auth/refresh")).status).toBe(401);
    await agent.post("/auth/login").send(alice);
    const refreshed = await agent.post("/auth/refresh");
    expect(refreshed.status).toBe(204);
    expect((await agent.get("/auth/me")).status).toBe(200);
  });

  it("reset closes the sessions and removes the registered users", async () => {
    const { agent, ctx } = setup();
    await agent.post("/auth/register").send({ email: "eve@mock.test", password: "abcdef12" });
    await agent.post("/auth/login").send(alice);
    await agent.post("/__admin/reset");
    expect((await agent.get("/auth/me")).status).toBe(401);
    expect(ctx.store.data.users.map((user) => user.email)).toEqual(["alice@mock.test", "bob@mock.test"]);
  });
});

describe("errors", () => {
  it("answers a malformed JSON body with 400 VALIDATION_ERROR", async () => {
    const { app } = setup();
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
    expect(http.errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("answers 404 NOT_FOUND for an unknown route", async () => {
    const { app } = setup();
    const res = await request(app).get("/auth/nope");
    expect(res.status).toBe(404);
    expect(http.errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
  });

  it("answers CORS preflight with the caller's origin and credentials", async () => {
    const { app } = setup();
    const res = await request(app).options("/auth/login").set("Origin", "http://localhost:5000");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
