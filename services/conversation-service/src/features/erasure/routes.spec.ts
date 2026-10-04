import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../../shared/error-handler.js";
import { createFileCleanup } from "../attachments/index.js";
import { FakeAttachmentsRepository } from "../../test-utils/fake-attachments-repository.js";
import { StubErasureRepository } from "../../test-utils/fake-erasure-repository.js";
import { FakeMessagesRepository } from "../../test-utils/fake-messages-repository.js";
import { FakeStorage } from "../../test-utils/fake-storage.js";
import { createErasureRouter } from "./routes.js";
import { ErasureService } from "./service.js";

const TOKEN = "a-service-token-that-is-long-enough-123";

function buildApp() {
  const repo = new StubErasureRepository();
  const files = createFileCleanup(new FakeMessagesRepository(), new FakeAttachmentsRepository(), new FakeStorage());
  const app = express();
  app.use(express.json());
  app.use("/internal", createErasureRouter(new ErasureService(repo, files), TOKEN));
  app.use(errorHandler);
  return { app, repo };
}

describe("createErasureRouter", () => {
  it("erases the user named in the body when the token is right", async () => {
    const { app, repo } = buildApp();
    const res = await request(app).post("/internal/erasures").set("Authorization", `Bearer ${TOKEN}`).send({ userId: "u1", email: "u1@example.com" });
    expect(res.status).toBe(200);
    expect(repo.calls).toEqual([{ userId: "u1", email: "u1@example.com" }]);
  });

  it("does nothing without the token", async () => {
    const { app, repo } = buildApp();
    const res = await request(app).post("/internal/erasures").send({ userId: "u1", email: "u1@example.com" });
    expect(res.status).toBe(401);
    expect(repo.calls).toEqual([]);
  });
});
