/**
 * AICHAT-203: on logout, auth-service calls this internal route so the replies the user started stop
 * (they spend that user's API key). Switching chats or closing the tab does not stop a reply
 * (AC-60/61); only logout does.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor, TEST_SERVICE_TOKEN } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";
import { createFakeQueue, stoppableProcessor } from "../test-utils/fake-queue.js";

const bearer = `Bearer ${TEST_SERVICE_TOKEN}`;

/** The real app with a queue whose replies run until they are stopped, so a test can read each reply's abort signal. */
function appWithRunningReplies() {
  const processor = stoppableProcessor();
  const testApp = buildTestApp({ overrides: { queueManager: createFakeQueue(processor) } });
  /** Abort signal of the reply started by the n-th send. */
  const signal = (n: number) => processor.mock.calls[n]?.[2] as AbortSignal;
  return { ...testApp, processor, signal };
}

async function send(app: Parameters<typeof request>[0], userId: string, chatId: string) {
  await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor(userId)).send({ content: "hi" }).expect(201);
}

describe("POST /internal/sessions/:userId/stop", () => {
  it("POST /internal/sessions/:userId/stop stops the replies the user started and only those", async () => {
    const { app, signal } = appWithRunningReplies();
    const chatOfAna = await createChatVia(app, "ana");
    const chatOfBen = await createChatVia(app, "ben");
    await send(app, "ana", chatOfAna);
    await send(app, "ben", chatOfBen);

    const res = await request(app).post("/internal/sessions/ana/stop").set("Authorization", bearer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stopped: 1 });
    expect(signal(0).aborted).toBe(true);
    expect(signal(1).aborted).toBe(false);
  });

  it("POST /internal/sessions/:userId/stop leaves a reply another member started in a shared chat running", async () => {
    const { app, signal } = appWithRunningReplies();
    const sharedChat = await createChatVia(app, "ana");
    await inviteVia(app, "ana", sharedChat, "ben@example.com");
    await send(app, "ben", sharedChat);

    const res = await request(app).post("/internal/sessions/ana/stop").set("Authorization", bearer);

    expect(res.body).toEqual({ stopped: 0 });
    expect(signal(0).aborted).toBe(false);
  });

  it("POST /internal/sessions/:userId/stop is safe to repeat: nothing running answers stopped 0", async () => {
    const { app } = appWithRunningReplies();
    const chat = await createChatVia(app, "ana");
    await send(app, "ana", chat);

    await request(app).post("/internal/sessions/ana/stop").set("Authorization", bearer).expect(200, { stopped: 1 });
    await request(app).post("/internal/sessions/ana/stop").set("Authorization", bearer).expect(200, { stopped: 0 });
  });

  it("POST /internal/sessions/:userId/stop rejects a missing or wrong service token and a user session", async () => {
    const { app, signal } = appWithRunningReplies();
    const chat = await createChatVia(app, "ana");
    await send(app, "ana", chat);

    for (const call of [
      request(app).post("/internal/sessions/ana/stop"),
      request(app).post("/internal/sessions/ana/stop").set("Authorization", "Bearer wrong-token"),
      request(app).post("/internal/sessions/ana/stop").set("Cookie", cookieFor("ana")),
    ]) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
    expect(signal(0).aborted).toBe(false);
  });
});
