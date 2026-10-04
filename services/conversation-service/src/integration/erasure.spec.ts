/** The internal erasure route called by auth-service when an account is deleted (AICHAT-79). */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { TEST_SERVICE_TOKEN } from "../test-utils/auth-token.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { createApp } from "../app.js";
import { parseEnv } from "../shared/env.js";
import { createLogger } from "../shared/logger.js";
import type { PrismaClient } from "../shared/prisma.js";
import { FakeStorage } from "../test-utils/fake-storage.js";
import { StubErasureRepository } from "../test-utils/fake-erasure-repository.js";

const bearer = `Bearer ${TEST_SERVICE_TOKEN}`;

describe("POST /internal/erasures", () => {
  it("POST /internal/erasures erases the user's data and answers with the counts", async () => {
    const { app, erasureRepo, storage } = buildTestApp();
    const storagePath = await storage.save(Buffer.from("file"), ".txt");
    erasureRepo.result = { chats: 2, memberships: 1, messages: 3, storagePaths: [storagePath] };

    const res = await request(app).post("/internal/erasures").set("Authorization", bearer).send({ userId: "u1", email: "U1@Example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ erased: { chats: 2, memberships: 1, messages: 3, files: 1 } });
    expect(erasureRepo.calls).toEqual([{ userId: "u1", email: "U1@Example.com" }]);
    expect(storage.has(storagePath)).toBe(false);
  });

  it("POST /internal/erasures is idempotent: a user with nothing left is a success", async () => {
    const { app } = buildTestApp();
    for (let i = 0; i < 2; i++) {
      const res = await request(app).post("/internal/erasures").set("Authorization", bearer).send({ userId: "gone", email: "gone@example.com" });
      expect(res.status).toBe(200);
      expect(res.body.erased).toEqual({ chats: 0, memberships: 0, messages: 0, files: 0 });
    }
  });

  it("POST /internal/erasures rejects a call without the service token", async () => {
    const { app, erasureRepo } = buildTestApp();
    const res = await request(app).post("/internal/erasures").send({ userId: "u1", email: "u1@example.com" });
    expect(res.status).toBe(401);
    expect(erasureRepo.calls).toHaveLength(0);
  });

  it("POST /internal/erasures rejects a wrong token, a token of another length and a user session", async () => {
    const { app, erasureRepo } = buildTestApp();
    for (const header of ["Bearer wrong-token", `Bearer ${TEST_SERVICE_TOKEN}x`, "Basic abc", "Bearer "]) {
      const res = await request(app).post("/internal/erasures").set("Authorization", header).send({ userId: "u1", email: "u1@example.com" });
      expect(res.status).toBe(401);
    }
    expect(erasureRepo.calls).toHaveLength(0);
  });

  it("POST /internal/erasures validates the body", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/internal/erasures").set("Authorization", bearer).send({ userId: "", email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("POST /internal/erasures answers 500 without internals when the database fails, so the caller can retry", async () => {
    const { app, erasureRepo } = buildTestApp();
    erasureRepo.failWith = new Error("database exploded: secret-internal-detail");
    const res = await request(app).post("/internal/erasures").set("Authorization", bearer).send({ userId: "u1", email: "u1@example.com" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("secret-internal-detail");
  });

  it("is not mounted when no service token is configured", async () => {
    const app = createApp({} as PrismaClient, parseEnv({ JWT_SECRET: "s", LOG_LEVEL: "silent" }), createLogger("silent"), {
      storage: new FakeStorage(),
      erasureRepo: new StubErasureRepository(),
    });
    const res = await request(app).post("/internal/erasures").set("Authorization", bearer).send({ userId: "u1", email: "u1@example.com" });
    expect(res.status).toBe(401); // falls through to the user authentication, never reaches erasure
  });
});
