/**
 * AICHAT-185: every route is called through the real app (in-memory Prisma fake) and each response
 * is checked against the OpenAPI route table: the status must be documented, the body must match
 * its Zod schema with no unknown field, and every error is the shared envelope with the
 * `X-Correlation-Id` header. The last test fails if a route's success response was never checked.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ErasureClient } from "../shared/erasure-client.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { createResponseChecker } from "../test-utils/documented-response.js";
import { cookieNamed, loginVia, PASSWORD, registerVia } from "../test-utils/session-helpers.js";

const { expectDocumentedResponse: check, uncheckedSuccesses } = createResponseChecker();

const workingErasure: ErasureClient = { eraseUser: async () => {} };
const brokenErasure: ErasureClient = {
  eraseUser: async () => {
    throw new Error("conversation-service is down");
  },
};

async function signedIn(options: { erasure?: ErasureClient; deletionsPerHour?: number } = {}) {
  const { app } = buildTestApp(undefined, options);
  await registerVia(app, "ana@example.com");
  const setCookie = await loginVia(app, "ana@example.com");
  return { app, access: cookieNamed(setCookie, "access_token"), refresh: cookieNamed(setCookie, "refresh_token") };
}

describe("operations", () => {
  it("GET /health and GET /metrics", async () => {
    const { app } = buildTestApp();
    check("GET /health", await request(app).get("/health"));
    check("GET /metrics", await request(app).get("/metrics"));
  });

  it("any route · 429 with the error envelope once the client is over the limit", async () => {
    const { app } = buildTestApp(undefined, { requestsPer15Minutes: 1 });
    check("GET /health", await request(app).get("/health"));
    const limited = await request(app).get("/health");
    expect(limited.status).toBe(429);
    check("GET /health", limited);
  });
});

describe("register and login", () => {
  it("POST /auth/register · 201, 400 and 409", async () => {
    const { app } = buildTestApp();
    check("POST /auth/register", await request(app).post("/auth/register").send({ email: "ana@example.com", password: PASSWORD }));
    check("POST /auth/register", await request(app).post("/auth/register").send({ email: "ana@example.com", password: PASSWORD }));
    check("POST /auth/register", await request(app).post("/auth/register").send({ email: "not-an-email", password: "short" }));
  });

  it("POST /auth/login · 200, and 401 for wrong credentials or an invalid body", async () => {
    const { app } = buildTestApp();
    await registerVia(app, "ana@example.com");
    check("POST /auth/login", await request(app).post("/auth/login").send({ email: "ana@example.com", password: PASSWORD }));
    check("POST /auth/login", await request(app).post("/auth/login").send({ email: "ana@example.com", password: "wrong-password1" }));
    check("POST /auth/login", await request(app).post("/auth/login").send({ email: 42 }));
  });
});

describe("session", () => {
  it("POST /auth/refresh · 204 and 401", async () => {
    const { app, refresh } = await signedIn();
    check("POST /auth/refresh", await request(app).post("/auth/refresh").set("Cookie", refresh));
    check("POST /auth/refresh", await request(app).post("/auth/refresh"));
  });

  it("POST /auth/logout · 204 with and without a session", async () => {
    const { app, refresh } = await signedIn();
    check("POST /auth/logout", await request(app).post("/auth/logout").set("Cookie", refresh));
    check("POST /auth/logout", await request(app).post("/auth/logout"));
  });

  it("GET /auth/me · 200 and 401", async () => {
    const { app, access } = await signedIn();
    check("GET /auth/me", await request(app).get("/auth/me").set("Cookie", access));
    check("GET /auth/me", await request(app).get("/auth/me"));
  });
});

describe("account deletion", () => {
  it("DELETE /auth/me · 204, 400, 401 and 403", async () => {
    const { app, access } = await signedIn({ erasure: workingErasure });
    check("DELETE /auth/me", await request(app).delete("/auth/me").set("Cookie", access).send({}));
    check("DELETE /auth/me", await request(app).delete("/auth/me").set("Cookie", access).send({ password: "wrong-password1" }));
    check("DELETE /auth/me", await request(app).delete("/auth/me").set("Cookie", access).set("Origin", "https://evil.example").send({ password: PASSWORD }));
    check("DELETE /auth/me", await request(app).delete("/auth/me").send({ password: PASSWORD }));
    check("DELETE /auth/me", await request(app).delete("/auth/me").set("Cookie", access).send({ password: PASSWORD }));
  });

  it("DELETE /auth/me · 502 when conversation-service fails, 503 when deletion is not configured", async () => {
    const broken = await signedIn({ erasure: brokenErasure });
    check("DELETE /auth/me", await request(broken.app).delete("/auth/me").set("Cookie", broken.access).send({ password: PASSWORD }));
    const unconfigured = await signedIn();
    check("DELETE /auth/me", await request(unconfigured.app).delete("/auth/me").set("Cookie", unconfigured.access).send({ password: PASSWORD }));
  });

  it("DELETE /auth/me · 429 from the deletion limiter, with the error envelope", async () => {
    const { app, access } = await signedIn({ erasure: brokenErasure, deletionsPerHour: 1 });
    await request(app).delete("/auth/me").set("Cookie", access).send({ password: PASSWORD });
    const limited = await request(app).delete("/auth/me").set("Cookie", access).send({ password: PASSWORD });
    expect(limited.status).toBe(429);
    check("DELETE /auth/me", limited);
  });
});

describe("coverage of the route table", () => {
  it("every route's success response was checked against its schema", () => {
    expect(uncheckedSuccesses()).toEqual([]);
  });
});
