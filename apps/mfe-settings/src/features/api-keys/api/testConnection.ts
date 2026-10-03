import {
  LLM_API_KEY_HEADER,
  buildTestConnectionPath,
  testConnectionResponseSchema,
  type Provider,
  type TestConnectionRequest,
  type TestConnectionResponse,
} from "@app/shared-types/api-keys";
import { CORRELATION_HEADER, generateCorrelationId } from "../../../shared/correlation";

const CONVERSATION_SERVICE_BASE_URL: string =
  (import.meta.env?.VITE_CONVERSATION_SERVICE_URL as string | undefined) ?? "";

/**
 * Calls `conversation-service`'s per-provider "test connection" endpoint (AC-85),
 * sending `apiKey` once in the `X-Llm-Api-Key` header (AC-81/AC-82/AC-83 contract) —
 * never in the request body, and never persisted here or on the server.
 *
 * Network failures and non-2xx responses are normalized into a `{ success: false,
 * message }` result rather than throwing, so the UI always has a clear failure reason
 * to show (AC-85) instead of an unhandled rejection.
 */
export async function testConnection(
  provider: Provider,
  apiKey: string,
): Promise<TestConnectionResponse> {
  const requestBody: TestConnectionRequest = { provider };

  let response: Response;
  try {
    response = await fetch(
      `${CONVERSATION_SERVICE_BASE_URL}${buildTestConnectionPath(provider)}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          [CORRELATION_HEADER]: generateCorrelationId(),
          [LLM_API_KEY_HEADER]: apiKey,
        },
        body: JSON.stringify(requestBody),
      },
    );
  } catch {
    return {
      success: false,
      message: "Network error: unable to reach the connection test service.",
    };
  }

  if (!response.ok) {
    return { success: false, message: await extractErrorMessage(response) };
  }

  try {
    const data: unknown = await response.json();
    return testConnectionResponseSchema.parse(data);
  } catch {
    return { success: false, message: "Received an unexpected response from the server." };
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    if (data && typeof data.message === "string") {
      return data.message;
    }
    if (data && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // Body wasn't JSON (or was empty); fall through to the status text.
  }
  return response.statusText || "Connection test failed";
}
