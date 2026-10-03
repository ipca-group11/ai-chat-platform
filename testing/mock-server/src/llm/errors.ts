import type { Rng } from "../prng.js";
import type { ScenarioDefinition } from "../registry.js";
import type { LlmProvider } from "./scenarios.js";

/** Seconds in the `retry-after` header of a 429. Short, so a test that waits for it stays fast. */
export const RETRY_AFTER_SECONDS = 2;

export interface ProviderErrorResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

interface ErrorSpec {
  type: string;
  message: string;
  /** OpenAI `error.code`. */
  code?: string;
  description: string;
}

/** Status codes each provider really answers with, and the body it sends. */
const ERRORS: Record<LlmProvider, Record<number, ErrorSpec>> = {
  anthropic: {
    401: { type: "authentication_error", message: "invalid x-api-key", description: "401 authentication_error" },
    429: {
      type: "rate_limit_error",
      message: "Number of request tokens has exceeded your per-minute rate limit",
      description: `429 rate_limit_error with retry-after: ${RETRY_AFTER_SECONDS}`,
    },
    500: { type: "api_error", message: "Internal server error", description: "500 api_error" },
    529: { type: "overloaded_error", message: "Overloaded", description: "529 overloaded_error (Anthropic only status)" },
  },
  openai: {
    401: {
      type: "invalid_request_error",
      code: "invalid_api_key",
      message: "Incorrect API key provided. You can find your API key at https://platform.openai.com/account/api-keys.",
      description: "401 invalid_api_key",
    },
    429: {
      type: "requests",
      code: "rate_limit_exceeded",
      message: "Rate limit reached for requests: Limit 3, Used 3, Requested 1. Please try again later.",
      description: `429 rate_limit_exceeded with retry-after: ${RETRY_AFTER_SECONDS}`,
    },
    500: {
      type: "server_error",
      message: "The server had an error while processing your request. Sorry about that!",
      description: "500 server_error",
    },
    503: {
      type: "server_error",
      message: "The engine is currently overloaded, please try again later",
      description: "503 server_error (OpenAI's overloaded status)",
    },
  },
};

/** An id for the `request-id` header and the error body, drawn from the seeded generator. */
export function requestId(rng: Rng): string {
  return `req_mock${rng.int(0, 0xffffff).toString(16).padStart(6, "0")}${rng.int(0, 0xffffff).toString(16).padStart(6, "0")}`;
}

const NAME =/^error-(\d{3})$/;

/** The HTTP error a scenario like `error-429` answers with, or undefined for other names. */
export function providerError(provider: LlmProvider, scenario: string, requestId: string): ProviderErrorResponse | undefined {
  const status = Number(NAME.exec(scenario)?.[1]);
  const spec = ERRORS[provider][status];
  if (!spec) return undefined;
  const headers: Record<string, string> = {};
  if (status === 429) headers["retry-after"] = String(RETRY_AFTER_SECONDS);
  if (provider === "anthropic") {
    headers["request-id"] = requestId;
    return {
      status,
      headers,
      body: { type: "error", error: { type: spec.type, message: spec.message }, request_id: requestId },
    };
  }
  headers["x-request-id"] = requestId;
  return {
    status,
    headers,
    body: { error: { message: spec.message, type: spec.type, param: null, code: spec.code ?? null } },
  };
}

export function errorScenarioDefinitions(provider: LlmProvider): ScenarioDefinition[] {
  return Object.entries(ERRORS[provider]).map(([status, spec]) => ({
    mock: provider,
    name: `error-${status}`,
    description: `Fails the request with ${spec.description}`,
  }));
}
