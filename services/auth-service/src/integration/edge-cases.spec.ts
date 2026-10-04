/** auth-service edge cases (AICHAT-134), through the whole app. */
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REFRESH_TOKEN_TTL_SECONDS } from "../shared/contracts/auth.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { cookieNamed, loginVia, registerVia } from "../test-utils/session-helpers.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /auth/refresh with an expired token", () => {
  it("401 INVALID_REFRESH_TOKEN once the refresh token's lifetime has passed", async () => {
    const { app } = buildTestApp();
    await registerVia(app, "ana@example.com");
    const refresh = cookieNamed(await loginVia(app, "ana@example.com"), "refresh_token");

    // Only the clock moves; timers stay real so the rest of the request still runs.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (REFRESH_TOKEN_TTL_SECONDS + 1) * 1000);

    const res = await request(app).post("/auth/refresh").set("Cookie", refresh);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});

describe("POST /auth/logout without a cookie", () => {
  it("204, clears the cookies and does not touch the database", async () => {
    const { app, prisma } = buildTestApp();
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
    const cleared = res.headers["set-cookie"] as unknown as string[];
    expect(cleared.some((c) => c.startsWith("access_token=;"))).toBe(true);
    expect(cleared.some((c) => c.startsWith("refresh_token=;"))).toBe(true);
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it("204 for a refresh token that was never issued", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/auth/logout").set("Cookie", "refresh_token=made-up");
    expect(res.status).toBe(204);
  });
});

describe("GET /auth/me for a deleted user", () => {
  it("401 UNAUTHENTICATED when the account no longer exists", async () => {
    const { app, prisma } = buildTestApp();
    const user = await registerVia(app, "ana@example.com");
    const access = cookieNamed(await loginVia(app, "ana@example.com"), "access_token");
    prisma.__removeUser(user.id);

    const res = await request(app).get("/auth/me").set("Cookie", access);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /auth/login with a malformed body", () => {
  it.each([
    ["an empty object", {}],
    ["an email that is not an email", { email: "nope", password: "password1" }],
    ["a missing password", { email: "ana@example.com" }],
    ["values of the wrong type", { email: 42, password: ["x"] }],
  ])("401 INVALID_CREDENTIALS for %s, without looking anyone up", async (_name, body) => {
    const { app, prisma } = buildTestApp();
    const res = await request(app).post("/auth/login").send(body);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(res.body.error.message).toBe("Invalid email or password");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("answers an empty body (no JSON at all) the same way", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/auth/login");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  // Pinned current behaviour (defect, WORKLOG §7): a body that is not valid JSON is
  // rejected by express.json() with a 400-class SyntaxError, but the error middleware only
  // knows HttpError and ZodError, so the client gets a 500 INTERNAL_ERROR instead of a 400.
  // Fixing it needs a new branch in the error middleware, not a one-line change.
  it("500 INTERNAL_ERROR for a body that is not valid JSON (pinned: should be 400)", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send("{not json");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/Unexpected token|SyntaxError|at /);
  });
});
