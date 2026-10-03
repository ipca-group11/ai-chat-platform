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
import type { PrismaClient } from "../../generated/prisma-client/index.js";

interface FakeUserRow {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface FakeRefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedFrom: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Minimal in-memory Prisma fake supporting both the register feature (`user.create`) and
 * the session feature (`user.findUnique` by email/id, `refreshToken.*`), so a single
 * mocked `shared/prisma` module can back an app that mounts both routers exactly like
 * `main.ts` does.
 */
function fakePrisma() {
  const usersByEmail = new Map<string, FakeUserRow>();
  const usersById = new Map<string, FakeUserRow>();
  const tokens = new Map<string, FakeRefreshTokenRow>();
  const tokensById = new Map<string, FakeRefreshTokenRow>();
  let nextUserId = 1;
  let nextTokenId = 1;

  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) return usersByEmail.get(where.email) ?? null;
        if (where.id) return usersById.get(where.id) ?? null;
        return null;
      }),
      create: vi.fn(async ({ data }: { data: { email: string; passwordHash: string } }) => {
        const user: FakeUserRow = {
          id: `user-${nextUserId++}`,
          email: data.email,
          passwordHash: data.passwordHash,
          createdAt: new Date(),
        };
        usersByEmail.set(user.email, user);
        usersById.set(user.id, user);
        return user;
      }),
    },
    refreshToken: {
      findUnique: vi.fn(
        async ({ where }: { where: { tokenHash: string } }) => {
          const row = tokens.get(where.tokenHash);
          if (!row) return null;
          return { ...row, user: usersById.get(row.userId) };
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { userId: string; tokenHash: string; expiresAt: Date; rotatedFrom?: string };
        }) => {
          const row: FakeRefreshTokenRow = {
            id: `token-${nextTokenId++}`,
            userId: data.userId,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            rotatedFrom: data.rotatedFrom ?? null,
            revokedAt: null,
            createdAt: new Date(),
          };
          tokens.set(row.tokenHash, row);
          tokensById.set(row.id, row);
          return row;
        },
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeRefreshTokenRow> }) => {
          const row = tokensById.get(where.id);
          if (!row) throw new Error("not found");
          Object.assign(row, data);
          return row;
        },
      ),
    },
  };

  return prisma as unknown as PrismaClient;
}

vi.mock("../../shared/prisma", () => ({ prisma: fakePrisma() }));

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
