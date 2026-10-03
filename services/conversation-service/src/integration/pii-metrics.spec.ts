/**
 * AICHAT-127: /metrics carries no PII. Sends traffic with planted fake PII in paths, query
 * strings, bodies and headers (matched routes with an email parameter, and unmatched ones),
 * scrapes /metrics and runs the shared detector over the whole scrape.
 */
import { describePii, findPii } from "@platform/pii-detector";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";

const CANARY = "PII-CANARY-7f3a";
const GUEST_EMAIL = "guest.metrics@pii-canary.example.com";
const CLIENT_IP = "203.0.113.77";
const canaries = [CANARY, GUEST_EMAIL, CLIENT_IP];

async function scrape(app: ReturnType<typeof buildTestApp>["app"]): Promise<string> {
  const res = await request(app).get("/metrics");
  expect(res.status).toBe(200);
  return res.text;
}

describe("conversation-service /metrics carries no PII", () => {
  it("stays clean after traffic on matched and unmatched routes", async () => {
    const { app } = buildTestApp();
    const owner = cookieFor("user-1");
    const from = { "X-Forwarded-For": CLIENT_IP };

    const chatId = await createChatVia(app, "user-1", { title: `${CANARY} title` });
    await inviteVia(app, "user-1", chatId, GUEST_EMAIL);
    await request(app).delete(`/chats/${chatId}/members/${encodeURIComponent(GUEST_EMAIL)}`).set(from).set("Cookie", owner);
    await request(app).post(`/chats/${chatId}/messages`).set(from).set("Cookie", owner).send({ content: `${CANARY} body` });
    await request(app).get(`/chats?q=${GUEST_EMAIL}`).set(from).set("Cookie", owner);
    await request(app).get(`/nope/${GUEST_EMAIL}?note=${CANARY}`).set(from).set("Cookie", owner);
    await request(app).get(`/nope/${encodeURIComponent(GUEST_EMAIL)}/${CLIENT_IP}`).set(from);

    const text = await scrape(app);
    expect(text).toContain("/chats/:id/members/:email");
    expect(describePii(findPii(text, { canaries }))).toBe("");
  });

  it("labels a route nobody handles as unmatched, never with the raw URL", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get(`/nope/${GUEST_EMAIL}?note=${CANARY}`).set("Cookie", cookieFor("user-1"));
    expect(res.status).toBe(404);

    const text = await scrape(app);
    expect(text).toMatch(/http_requests_total\{[^}]*route="unmatched"[^}]*status="404"[^}]*\} \d+/);
    expect(text).not.toContain("/nope");
  });
});
