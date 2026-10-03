import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PACT_BROKER_TOKEN_ENV,
  PACT_BROKER_URL_ENV,
  PACT_DIR,
  consumerName,
  pactBrokerConfig,
  pactConsumerOptions,
  providerName,
} from "./pact.config.js";

describe("consumerName / providerName (AC-95)", () => {
  it("AC-95: consumerName prefixes a bare name with mfe-", () => {
    expect(consumerName("auth")).toBe("mfe-auth");
  });

  it("AC-95: consumerName leaves an already-prefixed name unchanged", () => {
    expect(consumerName("mfe-chat")).toBe("mfe-chat");
  });

  it("AC-95: providerName suffixes a bare name with -service", () => {
    expect(providerName("auth")).toBe("auth-service");
  });

  it("AC-95: providerName leaves an already-suffixed name unchanged", () => {
    expect(providerName("conversation-service")).toBe("conversation-service");
  });
});

describe("pactConsumerOptions (AC-95)", () => {
  it("AC-95: builds normalized consumer/provider names plus the shared dir/logLevel", () => {
    const options = pactConsumerOptions("auth", "auth");
    expect(options.consumer).toBe("mfe-auth");
    expect(options.provider).toBe("auth-service");
    expect(options.dir).toBe(PACT_DIR);
    expect(options.logLevel).toBeTruthy();
  });
});

describe("pactBrokerConfig (AC-95)", () => {
  const originalUrl = process.env[PACT_BROKER_URL_ENV];
  const originalToken = process.env[PACT_BROKER_TOKEN_ENV];

  beforeEach(() => {
    delete process.env[PACT_BROKER_URL_ENV];
    delete process.env[PACT_BROKER_TOKEN_ENV];
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env[PACT_BROKER_URL_ENV];
    else process.env[PACT_BROKER_URL_ENV] = originalUrl;
    if (originalToken === undefined) delete process.env[PACT_BROKER_TOKEN_ENV];
    else process.env[PACT_BROKER_TOKEN_ENV] = originalToken;
  });

  it("AC-95: returns undefined when no broker URL is configured", () => {
    expect(pactBrokerConfig()).toBeUndefined();
  });

  it("AC-95: returns the URL and token when both are set", () => {
    process.env[PACT_BROKER_URL_ENV] = "https://broker.example.com";
    process.env[PACT_BROKER_TOKEN_ENV] = "secret-token";

    expect(pactBrokerConfig()).toEqual({
      pactBrokerUrl: "https://broker.example.com",
      pactBrokerToken: "secret-token",
    });
  });

  it("AC-95: returns just the URL when no token is set", () => {
    process.env[PACT_BROKER_URL_ENV] = "https://broker.example.com";

    expect(pactBrokerConfig()).toEqual({ pactBrokerUrl: "https://broker.example.com" });
  });
});
