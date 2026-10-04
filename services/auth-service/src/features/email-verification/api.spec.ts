import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "../../shared/env.js";
import { errorMiddleware } from "../../shared/error-middleware.js";
import { signAccessToken } from "../../shared/jwt.js";
import { fakePrisma, makeUser } from "../../test-utils/fake-prisma.js";
import { MemoryMailer } from "../../test-utils/memory-mailer.js";
import { createEmailVerificationRouter } from "./api.js";

async function setup(emailVerified = false) {
  const user = await makeUser("ana@example.com", "password1", { emailVerified });
  const prisma = fakePrisma({ users: [user] });
  const mailer = new MemoryMailer();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/auth", createEmailVerificationRouter(prisma, { mailer }));
  app.use(errorMiddleware);
  const cookie = `access_token=${signAccessToken({ sub: user.id, email: user.email, emailVerified }, env.JWT_SECRET)}`;
  return { app, user, prisma, mailer, cookie };
}

describe("email verification router", () => {
  it("resend then verify: 204 twice and the user is verified", async () => {
    const { app, user, mailer, cookie } = await setup();
    expect((await request(app).post("/auth/verify-email/resend").set("Cookie", cookie)).status).toBe(204);
    expect((await request(app).post("/auth/verify-email").send({ token: mailer.tokenFor(user.email) })).status).toBe(204);
    expect(user.emailVerified).toBe(true);
  });

  it("verify answers the same 400 for a malformed body as for a wrong token", async () => {
    const { app } = await setup();
    const malformed = await request(app).post("/auth/verify-email").send({ token: 42 });
    const wrong = await request(app).post("/auth/verify-email").send({ token: "1".repeat(64) });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toEqual(wrong.body.error);
  });

  it("resend needs a session and refuses an already verified address", async () => {
    expect((await request((await setup()).app).post("/auth/verify-email/resend")).status).toBe(401);
    const verified = await setup(true);
    const res = await request(verified.app).post("/auth/verify-email/resend").set("Cookie", verified.cookie);
    expect(res.status).toBe(409);
    expect(verified.mailer.sent).toEqual([]);
  });
});
