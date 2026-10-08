import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../shared/error-handler.js";
import { createInternalSessionsRouter } from "./internal-routes.js";
import type { MessagesService } from "./service.js";

const TOKEN = "a-service-token-that-is-long-enough-123";

function buildApp(stopped = 1) {
  const service = { stopAllForUser: vi.fn(() => ({ stopped })) };
  const app = express();
  app.use("/internal", createInternalSessionsRouter(service as unknown as MessagesService, TOKEN));
  app.use(errorHandler);
  return { app, service };
}

describe("createInternalSessionsRouter (AICHAT-203)", () => {
  it("stops the replies of the user named in the path and answers with the count", async () => {
    const { app, service } = buildApp(2);

    const res = await request(app).post("/internal/sessions/u1/stop").set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stopped: 2 });
    expect(service.stopAllForUser).toHaveBeenCalledExactlyOnceWith("u1");
  });

  it("does nothing without the service token", async () => {
    const { app, service } = buildApp();

    const res = await request(app).post("/internal/sessions/u1/stop");

    expect(res.status).toBe(401);
    expect(service.stopAllForUser).not.toHaveBeenCalled();
  });
});
