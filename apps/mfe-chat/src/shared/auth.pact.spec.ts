import { correlationHeaderMatcher, errorResponseMatcher, like, newConsumerPact, runWithMockServer } from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { fetchCurrentUser } from "./auth";

// Contract mfe-chat -> auth-service (AICHAT-178): who is signed in, used to key the
// browser-held API key and to tell own messages from other members'.
const pact = newConsumerPact("mfe-chat", "auth-service");

const correlation = { "X-Correlation-Id": correlationHeaderMatcher() };

describe("mfe-chat -> auth-service", () => {
  it("GET /auth/me returns the user id and email", async () => {
    pact
      .given("a user is logged in", { email: "alice@example.com" })
      .uponReceiving("a request for the current user from the chat")
      .withRequest({ method: "GET", path: "/auth/me", headers: correlation })
      .willRespondWith({ status: 200, headers: correlation, body: { id: like("user-1"), email: like("alice@example.com") } });

    await expect(runWithMockServer(pact, () => fetchCurrentUser())).resolves.toEqual({ id: "user-1", email: "alice@example.com" });
  });

  it("GET /auth/me without a session is a 401", async () => {
    pact
      .given("no user is logged in")
      .uponReceiving("a request for the current user from the chat without a session")
      .withRequest({ method: "GET", path: "/auth/me", headers: correlation })
      .willRespondWith({ status: 401, headers: correlation, body: errorResponseMatcher({ code: "UNAUTHENTICATED" }) });

    await expect(runWithMockServer(pact, () => fetchCurrentUser())).rejects.toThrow("GET /auth/me failed with 401");
  });
});
