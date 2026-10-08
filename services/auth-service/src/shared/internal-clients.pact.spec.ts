import { like, newConsumerPact, runWithMockServer, term } from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { createErasureClient } from "./erasure-client.js";
import { createReplyStopClient } from "./reply-stop-client.js";

// Contract auth-service -> conversation-service (AICHAT-179): the two internal routes called
// with the service token. The token is matched by its form only; conversation-service's
// verifier sends its own token (AICHAT-181).
const pact = newConsumerPact("auth-service", "conversation-service");

const BASE_URL = "http://conversation-service:4002";
const serviceToken = { Authorization: term("Bearer .+", "Bearer internal-service-token") };
const clientOptions = { baseUrl: BASE_URL, token: "internal-service-token" };

describe("auth-service -> conversation-service", () => {
  it("POST /internal/erasures erases the user's chats (200)", async () => {
    pact
      .given("a user has chats", { userId: "user-1", email: "alice@example.com" })
      .uponReceiving("a request to erase a deleted user's data")
      .withRequest({
        method: "POST",
        path: "/internal/erasures",
        headers: { ...serviceToken, "Content-Type": "application/json" },
        body: { userId: "user-1", email: "alice@example.com" },
      })
      // The client only needs a 2xx; the summary in the body is not read.
      .willRespondWith({ status: 200 });

    await expect(
      runWithMockServer(pact, () => createErasureClient(clientOptions).eraseUser("user-1", "alice@example.com")),
    ).resolves.toBeUndefined();
  });

  it("POST /internal/sessions/:userId/stop stops the user's replies and says how many", async () => {
    pact
      .given("a user has a reply in progress", { userId: "user-1" })
      .uponReceiving("a request to stop a logged-out user's replies")
      .withRequest({ method: "POST", path: "/internal/sessions/user-1/stop", headers: serviceToken })
      .willRespondWith({ status: 200, body: { stopped: like(1) } });

    await expect(runWithMockServer(pact, () => createReplyStopClient(clientOptions).stopUserReplies("user-1"))).resolves.toBe(1);
  });
});
