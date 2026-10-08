import {
  correlationHeaderMatcher,
  errorResponseMatcher,
  like,
  newConsumerPact,
  runWithMockServer,
} from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { fetchMe, refreshSession } from "./session";

// Contract mfe-auth -> auth-service for the session calls (AICHAT-178). The real client
// functions run against the Pact mock server; the access/refresh cookies are not part of
// the contract, auth-service's verifier adds them for each provider state (AICHAT-180).
const pact = newConsumerPact("mfe-auth", "auth-service");

const sentHeaders = { "X-Correlation-Id": correlationHeaderMatcher() };
const echoedHeaders = { "X-Correlation-Id": correlationHeaderMatcher() };

describe("mfe-auth -> auth-service: session", () => {
  it("GET /auth/me returns the logged-in user", async () => {
    pact
      .given("a user is logged in", { email: "alice@example.com" })
      .uponReceiving("a request for the current user")
      .withRequest({ method: "GET", path: "/auth/me", headers: sentHeaders })
      .willRespondWith({
        status: 200,
        headers: echoedHeaders,
        body: { id: like("user-1"), email: like("alice@example.com") },
      });

    const user = await runWithMockServer(pact, () => fetchMe());

    expect(user).toEqual({ id: "user-1", email: "alice@example.com" });
  });

  it("GET /auth/me without a session is a 401 with the error envelope", async () => {
    pact
      .given("no user is logged in")
      .uponReceiving("a request for the current user without a session")
      .withRequest({ method: "GET", path: "/auth/me", headers: sentHeaders })
      .willRespondWith({ status: 401, headers: echoedHeaders, body: errorResponseMatcher({ code: "UNAUTHENTICATED" }) });

    const failure = runWithMockServer(pact, () => fetchMe());

    // 401 is what makes fetchSessionWithRefresh try one refresh; the message is shown as is.
    await expect(failure).rejects.toMatchObject({ status: 401, message: "A human-readable error message." });
  });

  it("POST /auth/refresh with a valid refresh token answers 204", async () => {
    pact
      .given("a user has a valid refresh token", { email: "alice@example.com" })
      .uponReceiving("a refresh request")
      .withRequest({ method: "POST", path: "/auth/refresh", headers: sentHeaders })
      .willRespondWith({ status: 204, headers: echoedHeaders });

    await expect(runWithMockServer(pact, () => refreshSession())).resolves.toBeUndefined();
  });

  it("POST /auth/refresh without a valid refresh token is a 401", async () => {
    pact
      .given("no user is logged in")
      .uponReceiving("a refresh request without a valid refresh token")
      .withRequest({ method: "POST", path: "/auth/refresh", headers: sentHeaders })
      .willRespondWith({ status: 401, headers: echoedHeaders, body: errorResponseMatcher({ code: "INVALID_REFRESH_TOKEN" }) });

    await expect(runWithMockServer(pact, () => refreshSession())).rejects.toMatchObject({ status: 401 });
  });
});
