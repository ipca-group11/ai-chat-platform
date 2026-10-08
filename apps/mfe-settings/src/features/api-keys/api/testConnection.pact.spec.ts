import { correlationHeaderMatcher, like, newConsumerPact, runWithMockServer, term } from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { testConnection } from "./testConnection";

// Contract mfe-settings -> conversation-service (AICHAT-179): "Test connection" for a stored
// key. Written as the client calls it today; conversation-service has no such route yet
// (AICHAT-256), so provider verification lists these interactions as known failures.
const pact = newConsumerPact("mfe-settings", "conversation-service");
const run = <T>(call: () => Promise<T>) => runWithMockServer(pact, call, { stripPrefix: "/api" });

const request = (key: string) => ({
  method: "POST",
  path: "/providers/anthropic/test-connection",
  headers: {
    "X-Correlation-Id": correlationHeaderMatcher(),
    "Content-Type": "application/json",
    "X-Llm-Api-Key": term(".+", key),
  },
  body: { provider: "anthropic" },
});

describe("mfe-settings -> conversation-service", () => {
  it("a key the provider accepts answers { success: true }", async () => {
    pact
      .given("the LLM provider accepts the API key", { provider: "anthropic" })
      .uponReceiving("a connection test with a valid key")
      .withRequest(request("sk-valid-key"))
      .willRespondWith({ status: 200, body: { success: true } });

    await expect(run(() => testConnection("anthropic", "sk-valid-key"))).resolves.toEqual({ success: true });
  });

  it("a key the provider rejects answers 200 { success: false, message }", async () => {
    pact
      .given("the LLM provider rejects the API key", { provider: "anthropic" })
      .uponReceiving("a connection test with a rejected key")
      .withRequest(request("invalid-key"))
      .willRespondWith({ status: 200, body: { success: false, message: like("The provider rejected the API key.") } });

    await expect(run(() => testConnection("anthropic", "invalid-key"))).resolves.toEqual({
      success: false,
      message: "The provider rejected the API key.",
    });
  });
});
