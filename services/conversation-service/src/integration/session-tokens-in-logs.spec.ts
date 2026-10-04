/**
 * AICHAT-112: session tokens and the LLM API key never reach the logs. Calls the routes with a
 * cookie, an `Authorization` header and the per-request API key (success, 4xx and 500), then
 * looks for those exact values, and for anything shaped like a token, in every log line.
 */
import { createLogCapture, describePii, findPiiInLines } from "@platform/pii-detector";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ChatsRepository } from "../features/chats/service.js";
import { createLogger } from "../shared/logger.js";
import { tokenFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";
import { throwingRepository } from "../test-utils/throwing-repository.js";

const API_KEY = "sk-ant-api03-CanaryKey1234567890";

describe("conversation-service logs carry no token or API key", () => {
  it("stay clean for cookie, Authorization and X-Llm-Api-Key on success and failure", async () => {
    const logs = createLogCapture();
    const t = buildTestApp({ logger: createLogger("debug", logs) });
    const token = tokenFor("user-1");
    const auth = { Cookie: `access_token=${token}`, Authorization: `Bearer ${token}`, "X-Llm-Api-Key": API_KEY };

    const chatId = await createChatVia(t.app, "user-1");
    await request(t.app).post(`/chats/${chatId}/messages`).set(auth).send({ content: "hello" });
    await request(t.app).post(`/chats/${chatId}/messages`).set(auth).send({ content: "" }); // 400
    await request(t.app).get(`/chats/no-such-chat`).set(auth); // 404
    await request(t.app).get(`/chats/${chatId}`).set({ "X-Llm-Api-Key": API_KEY, Cookie: "access_token=not-a-valid-token-value" }); // 401

    const lines = logs.lines();
    expect(lines.length).toBeGreaterThan(0);
    expect(describePii(findPiiInLines(lines, { canaries: [token, API_KEY, `access_token=${token}`], ignore: ["email", "ip"] }))).toBe("");
  });

  it("stay clean when a route fails with an unexpected error", async () => {
    const logs = createLogCapture();
    const t = buildTestApp({
      logger: createLogger("debug", logs),
      overrides: { chatsRepo: throwingRepository<ChatsRepository>() },
    });
    const token = tokenFor("user-1");
    const res = await request(t.app).get("/chats").set({ Cookie: `access_token=${token}`, "X-Llm-Api-Key": API_KEY });
    expect(res.status).toBe(500);
    expect(logs.lines().length).toBeGreaterThan(0);
    expect(describePii(findPiiInLines(logs.lines(), { canaries: [token, API_KEY], ignore: ["email", "ip"] }))).toBe("");
  });
});
