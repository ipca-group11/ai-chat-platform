import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorMiddleware } from "../../shared/error-middleware.js";
import { correlationIdMiddleware } from "../../shared/correlation-id.js";
import { signAccessToken } from "../../shared/jwt.js";
import { env } from "../../shared/env.js";
import { fakePrisma, makeUser } from "../../test-utils/fake-prisma.js";
import { createAccountRouter } from "./api.js";

async function setup(erasure?: { eraseUser: ReturnType<typeof vi.fn> }) {
  const prisma = fakePrisma();
  const user = await makeUser("ana@example.com", "password1");
  prisma.__addUser(user);
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(correlationIdMiddleware);
  app.use("/auth", createAccountRouter(prisma, { erasure }));
  app.use(errorMiddleware);
  const cookie = `access_token=${signAccessToken({ sub: user.id, email: user.email, emailVerified: false }, env.JWT_SECRET)}`;
  return { app, prisma, user, cookie };
}

describe("account router", () => {
  it("deletes the account after erasing the conversation data", async () => {
    const erasure = { eraseUser: vi.fn().mockResolvedValue(undefined) };
    const { app, prisma, user, cookie } = await setup(erasure);

    const res = await request(app).delete("/auth/me").set("Cookie", cookie).send({ password: "password1" });

    expect(res.status).toBe(204);
    expect(erasure.eraseUser).toHaveBeenCalledWith(user.id, user.email);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it("answers 503 and keeps the account when erasure is not configured", async () => {
    const { app, prisma, user, cookie } = await setup(undefined);

    const res = await request(app).delete("/auth/me").set("Cookie", cookie).send({ password: "password1" });

    expect(res.status).toBe(503);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });
});
