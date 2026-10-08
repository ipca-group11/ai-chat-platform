import {
  correlationHeaderMatcher,
  errorResponseMatcher,
  fieldErrorsMatcher,
  like,
  newConsumerPact,
  runWithMockServer,
} from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { registerUser } from "./register";

// Contract mfe-auth -> auth-service for registration (AICHAT-178).
const pact = newConsumerPact("mfe-auth", "auth-service");

const correlation = { "X-Correlation-Id": correlationHeaderMatcher() };
const sent = { ...correlation, "Content-Type": "application/json" };
const newUser = { email: "bob@example.com", password: "correct-horse-1" };

describe("mfe-auth -> auth-service: register", () => {
  it("POST /auth/register creates the account (201)", async () => {
    pact
      .given("no user exists with the email", { email: newUser.email })
      .uponReceiving("a registration with a new email")
      .withRequest({ method: "POST", path: "/auth/register", headers: sent, body: newUser })
      .willRespondWith({ status: 201, headers: correlation, body: { id: like("user-2"), email: like(newUser.email) } });

    await expect(runWithMockServer(pact, () => registerUser(newUser))).resolves.toEqual({
      id: "user-2",
      email: newUser.email,
    });
  });

  it("POST /auth/register with a taken email is a 409", async () => {
    pact
      .given("a user exists", newUser)
      .uponReceiving("a registration with an email that is already taken")
      .withRequest({ method: "POST", path: "/auth/register", headers: sent, body: newUser })
      .willRespondWith({ status: 409, headers: correlation, body: errorResponseMatcher({ code: "EMAIL_TAKEN" }) });

    await expect(runWithMockServer(pact, () => registerUser(newUser))).rejects.toMatchObject({
      status: 409,
      message: "A human-readable error message.",
    });
  });

  it("POST /auth/register with a weak password is a 400 with field errors", async () => {
    const weak = { email: newUser.email, password: "short" };
    pact
      .given("no user exists with the email", { email: newUser.email })
      .uponReceiving("a registration with a password that is too short")
      .withRequest({ method: "POST", path: "/auth/register", headers: sent, body: weak })
      .willRespondWith({ status: 400, headers: correlation, body: fieldErrorsMatcher("password") });

    await expect(runWithMockServer(pact, () => registerUser(weak))).rejects.toMatchObject({ status: 400 });
  });
});
