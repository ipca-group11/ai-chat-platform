import {
  correlationHeaderMatcher,
  errorResponseMatcher,
  like,
  newConsumerPact,
  runWithMockServer,
} from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { loginUser, logoutUser } from "./login";

// Contract mfe-auth -> auth-service for login and logout (AICHAT-178).
const pact = newConsumerPact("mfe-auth", "auth-service");

const correlation = { "X-Correlation-Id": correlationHeaderMatcher() };
const credentials = { email: "alice@example.com", password: "correct-horse-1" };

describe("mfe-auth -> auth-service: login and logout", () => {
  it("POST /auth/login with valid credentials returns the user", async () => {
    pact
      .given("a user exists", credentials)
      .uponReceiving("a login with valid credentials")
      .withRequest({
        method: "POST",
        path: "/auth/login",
        headers: { ...correlation, "Content-Type": "application/json" },
        body: credentials,
      })
      .willRespondWith({ status: 200, headers: correlation, body: { id: like("user-1"), email: like(credentials.email) } });

    await expect(runWithMockServer(pact, () => loginUser(credentials))).resolves.toEqual({
      id: "user-1",
      email: credentials.email,
    });
  });

  it("POST /auth/login with a wrong password is a 401 whose message reaches the form", async () => {
    pact
      .given("a user exists", credentials)
      .uponReceiving("a login with a wrong password")
      .withRequest({
        method: "POST",
        path: "/auth/login",
        headers: { ...correlation, "Content-Type": "application/json" },
        body: { email: credentials.email, password: "wrong-password-1" },
      })
      .willRespondWith({ status: 401, headers: correlation, body: errorResponseMatcher({ code: "INVALID_CREDENTIALS" }) });

    const failure = runWithMockServer(pact, () => loginUser({ email: credentials.email, password: "wrong-password-1" }));

    await expect(failure).rejects.toMatchObject({ status: 401, message: "A human-readable error message." });
  });

  it("POST /auth/logout answers 204", async () => {
    pact
      .given("a user is logged in", { email: credentials.email })
      .uponReceiving("a logout request")
      .withRequest({ method: "POST", path: "/auth/logout", headers: correlation })
      .willRespondWith({ status: 204, headers: correlation });

    await expect(runWithMockServer(pact, () => logoutUser())).resolves.toBeUndefined();
  });
});
