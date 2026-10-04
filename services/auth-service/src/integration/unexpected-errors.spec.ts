/** An unexpected failure behind any router answers with a safe 500 (AICHAT-125): the
 * standard error body and nothing of the underlying error. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signAccessToken } from "../shared/jwt.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { expectSafe500 } from "../test-utils/expect-safe-500.js";
import { throwingPrisma } from "../test-utils/fake-prisma.js";

describe("unexpected errors", () => {
  it("register router: POST /auth/register returns a safe 500 when the database fails", async () => {
    const { app } = buildTestApp(throwingPrisma());
    const res = await request(app).post("/auth/register").send({ email: "ana@example.com", password: "password1" }).set("X-Correlation-Id", "corr-500");
    expectSafe500(res);
    expect(res.body.correlationId).toBe("corr-500");
  });

  it("session router: POST /auth/login returns a safe 500 when the database fails", async () => {
    const { app } = buildTestApp(throwingPrisma());
    expectSafe500(await request(app).post("/auth/login").send({ email: "ana@example.com", password: "password1" }));
  });

  it("session router: GET /auth/me returns a safe 500 when the database fails", async () => {
    const { app } = buildTestApp(throwingPrisma());
    const token = signAccessToken({ sub: "user-1", email: "ana@example.com", emailVerified: false }, process.env.JWT_SECRET as string);
    expectSafe500(await request(app).get("/auth/me").set("Cookie", `access_token=${token}`));
  });
});
