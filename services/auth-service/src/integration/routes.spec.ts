/**
 * Whole-app integration suite: every auth-service route is called through the real
 * `createApp` with an in-memory Prisma fake. Test titles start with the route they
 * cover ("METHOD /path"); `route-inventory.spec.ts` relies on that.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { cookieNamed, loginVia, PASSWORD, registerVia } from "../test-utils/session-helpers.js";

describe("GET /health and GET /metrics", () => {
  it("GET /health · 200 with a correlation id", async () => {
    const res = await request(buildTestApp().app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers["x-correlation-id"]).toBeTruthy();
  });

  it("GET /metrics · 200 with the service's metrics", async () => {
    const res = await request(buildTestApp().app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("auth_service_");
  });
});

describe("auth routes", () => {
  it("POST /auth/register · 201 creates the account; 409 for a duplicate; 400 for a weak password", async () => {
    const { app, prisma } = buildTestApp();

    const ok = await request(app).post("/auth/register").send({ email: "ana@example.com", password: PASSWORD });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ email: "ana@example.com" });
    expect(JSON.stringify(ok.body)).not.toContain("passwordHash");
    expect(prisma.user.create).toHaveBeenCalledTimes(1);

    const dup = await request(app).post("/auth/register").send({ email: "ana@example.com", password: PASSWORD });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("EMAIL_TAKEN");

    const weak = await request(app).post("/auth/register").send({ email: "bo@example.com", password: "short" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/login · 200 sets both cookies; 401 for a wrong password", async () => {
    const { app } = buildTestApp();
    const user = await registerVia(app, "ana@example.com");

    const ok = await request(app).post("/auth/login").send({ email: "ana@example.com", password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(user);
    const cookies = ok.headers["set-cookie"] as unknown as string[];
    expect(cookieNamed(cookies, "access_token")).toBeTruthy();
    expect(cookieNamed(cookies, "refresh_token")).toBeTruthy();

    const bad = await request(app).post("/auth/login").send({ email: "ana@example.com", password: "wrong-password1" });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /auth/refresh · 204 rotates the cookies; 401 when the old token is reused", async () => {
    const { app } = buildTestApp();
    await registerVia(app, "ana@example.com");
    const refresh = cookieNamed(await loginVia(app, "ana@example.com"), "refresh_token");

    const ok = await request(app).post("/auth/refresh").set("Cookie", refresh);
    expect(ok.status).toBe(204);
    expect(cookieNamed(ok.headers["set-cookie"] as unknown as string[], "refresh_token")).not.toBe(refresh);

    const reused = await request(app).post("/auth/refresh").set("Cookie", refresh);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("POST /auth/logout · 204 clears the cookies and revokes the refresh token", async () => {
    const { app } = buildTestApp();
    await registerVia(app, "ana@example.com");
    const cookies = await loginVia(app, "ana@example.com");
    const refresh = cookieNamed(cookies, "refresh_token");

    const res = await request(app).post("/auth/logout").set("Cookie", refresh);
    expect(res.status).toBe(204);
    const cleared = res.headers["set-cookie"] as unknown as string[];
    expect(cleared.some((c) => c.startsWith("refresh_token=;"))).toBe(true);
    expect((await request(app).post("/auth/refresh").set("Cookie", refresh)).status).toBe(401);
  });

  it("GET /auth/me · 200 for a signed-in user; 401 without a cookie", async () => {
    const { app } = buildTestApp();
    const user = await registerVia(app, "ana@example.com");
    const access = cookieNamed(await loginVia(app, "ana@example.com"), "access_token");

    const ok = await request(app).get("/auth/me").set("Cookie", access);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(user);
    expect((await request(app).get("/auth/me")).status).toBe(401);
  });
});
