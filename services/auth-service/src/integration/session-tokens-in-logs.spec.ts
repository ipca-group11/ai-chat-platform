/**
 * AICHAT-112: session tokens never reach the logs. Logs in, refreshes and logs out through
 * the real app, then looks for the exact cookie and token values the service issued, and for
 * anything shaped like a token, in every log line (including the `Set-Cookie` of the response).
 */
import { createLogCapture, describePii, findPiiInLines } from "@platform/pii-detector";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "../shared/logger.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { throwingPrisma } from "../test-utils/fake-prisma.js";
import { cookieNamed, PASSWORD, registerVia } from "../test-utils/session-helpers.js";

const EMAIL = "ana.tokens@pii-canary.example.com";

function valueOf(cookie: string): string {
  return cookie.split("=")[1] as string;
}

describe("auth-service logs carry no session token", () => {
  it("keeps Set-Cookie, Cookie and the token values out of the log lines", async () => {
    const logs = createLogCapture();
    const { app } = buildTestApp(undefined, { logger: createLogger(logs, "debug") });
    await registerVia(app, EMAIL);

    const login = await request(app).post("/auth/login").send({ email: EMAIL, password: PASSWORD });
    const setCookie = login.headers["set-cookie"] as unknown as string[];
    const access = cookieNamed(setCookie, "access_token");
    const refresh = cookieNamed(setCookie, "refresh_token");

    const refreshed = await request(app).post("/auth/refresh").set("Cookie", refresh);
    const rotated = refreshed.headers["set-cookie"] as unknown as string[];
    await request(app).get("/auth/me").set("Cookie", access).set("Authorization", `Bearer ${valueOf(access)}`);
    await request(app).post("/auth/logout").set("Cookie", cookieNamed(rotated, "refresh_token"));

    const canaries = [access, refresh, cookieNamed(rotated, "access_token"), cookieNamed(rotated, "refresh_token"), ...[access, refresh].map(valueOf)];
    const lines = logs.lines();
    expect(lines.length).toBeGreaterThan(0);
    expect(describePii(findPiiInLines(lines, { canaries, ignore: ["email", "ip"] }))).toBe("");
    expect(lines.join("\n").toLowerCase()).not.toContain("set-cookie");
  });

  it("keeps tokens out of an error log too", async () => {
    const logs = createLogCapture();
    const { app } = buildTestApp(throwingPrisma(), { logger: createLogger(logs, "debug") });
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl";
    const res = await request(app).get("/auth/me").set("Cookie", `access_token=${token}`);
    expect(res.status).toBe(401);
    expect(describePii(findPiiInLines(logs.lines(), { canaries: [token], ignore: ["email", "ip"] }))).toBe("");
  });
});
