/**
 * AICHAT-94: drive every route of auth-service with planted fake PII and prove none of it
 * reaches the logs. The logger writes to memory; the assertions use the shared detector from
 * `@platform/test-utils/pii`. Session tokens and `Set-Cookie` are checked in
 * `session-tokens-in-logs.spec.ts` (AICHAT-112), so the "token" kind is skipped here.
 */
import { createLogCapture, describePii, findPiiInLines } from "@platform/test-utils/pii";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "../shared/logger.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { throwingPrisma } from "../test-utils/fake-prisma.js";
import { cookieNamed, loginVia, PASSWORD, registerVia } from "../test-utils/session-helpers.js";

const CANARY = "PII-CANARY-7f3a";
const EMAIL = "ana.canary@pii-canary.example.com";
const OTHER_EMAIL = "bo.canary@pii-canary.example.com";
const CLIENT_IP = "203.0.113.77";
const canaries = [CANARY, EMAIL, OTHER_EMAIL, CLIENT_IP];

function capturedApp(prisma?: Parameters<typeof buildTestApp>[0]) {
  const logs = createLogCapture();
  const t = buildTestApp(prisma, { logger: createLogger(logs, "debug") });
  return { ...t, logs };
}

function expectNoPii(logs: ReturnType<typeof createLogCapture>) {
  expect(logs.lines().length).toBeGreaterThan(0); // the test must have produced log lines
  expect(describePii(findPiiInLines(logs.lines(), { canaries, ignore: ["token"] }))).toBe("");
}

describe("auth-service logs carry no PII", () => {
  it("stay clean across every route, success and failure", async () => {
    const { app, logs } = capturedApp();
    const from = { "X-Forwarded-For": CLIENT_IP, "X-Real-Ip": CLIENT_IP, "X-Correlation-Id": "corr-1" };

    await request(app).get("/health").set(from);
    await request(app).get("/metrics").set(from);
    await request(app).get(`/nope/${EMAIL}?email=${OTHER_EMAIL}&note=${CANARY}`).set(from);

    await registerVia(app, EMAIL);
    await request(app).post("/auth/register").set(from).send({ email: EMAIL, password: PASSWORD }); // 409
    await request(app).post("/auth/register").set(from).send({ email: OTHER_EMAIL, password: "short" }); // 400
    await request(app).post("/auth/login").set(from).send({ email: EMAIL, password: "wrong-password1" }); // 401
    const cookies = await loginVia(app, EMAIL);
    const refresh = cookieNamed(cookies, "refresh_token");
    const access = cookieNamed(cookies, "access_token");

    await request(app).get(`/auth/me?email=${EMAIL}`).set(from).set("Cookie", access);
    await request(app).get("/auth/me").set(from); // 401
    await request(app).post("/auth/refresh").set(from).set("Cookie", refresh);
    await request(app).post("/auth/refresh").set(from).set("Cookie", refresh); // reuse, 401
    await request(app).post("/auth/refresh").set(from); // no cookie, 401
    await request(app).post("/auth/logout").set(from).set("Cookie", refresh);

    await request(app).post("/auth/login").set(from).set("Content-Type", "application/json").send(`{"email": "${EMAIL}", "note": "${CANARY}`); // malformed JSON

    expectNoPii(logs);
  });

  it("stay clean when an unexpected error mentions an email", async () => {
    const error = new Error(`Unique constraint failed on email ${EMAIL} (${CLIENT_IP}), note ${CANARY}`);
    const { app, logs } = capturedApp(throwingPrisma(error));
    const res = await request(app).post("/auth/login").send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(500);
    expectNoPii(logs);
  });
});
