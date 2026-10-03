/**
 * Integration test spanning the register and session features (PLAN.md B2+B3): verifies
 * AC-34 end-to-end — a freshly registered user can immediately log in with the exact
 * credentials they registered with, going through the real `registerUser`/
 * `verifyCredentials` business logic (bcrypt hash + compare) against a single shared
 * in-memory fake of `shared/prisma`, wired the same way `main.ts` mounts both routers.
 */
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shared/prisma", async () => {
  const { fakePrisma } = await import("../../test-utils/fake-prisma.js");
  return { prisma: fakePrisma() };
});

const { registerRouter } = await import("../register/index.js");
const { sessionRouter } = await import("./api.js");
const { errorMiddleware } = await import("../../shared/error-middleware.js");
const { correlationIdMiddleware } = await import("../../shared/correlation-id.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(correlationIdMiddleware);
  app.use(registerRouter);
  app.use("/auth", sessionRouter);
  app.use(errorMiddleware);
  return app;
}

describe("register then login (cross-feature integration)", () => {
  const app = buildApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-34: after a successful registration, the user can immediately log in with those exact credentials", async () => {
    const registerRes = await request(app)
      .post("/register")
      .send({ email: "fresh-signup@example.com", password: "password1" });

    expect(registerRes.status).toBe(201);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "fresh-signup@example.com", password: "password1" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toEqual({ id: registerRes.body.id, email: "fresh-signup@example.com" });
    expect(loginRes.headers["set-cookie"]).toBeTruthy();
  });

  it("AC-34: logging in with the wrong password right after registration is still rejected", async () => {
    await request(app)
      .post("/register")
      .send({ email: "fresh-signup-2@example.com", password: "password1" });

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "fresh-signup-2@example.com", password: "wrong-password1" });

    expect(loginRes.status).toBe(401);
  });
});
