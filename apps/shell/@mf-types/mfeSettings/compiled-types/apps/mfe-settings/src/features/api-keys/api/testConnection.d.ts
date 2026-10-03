import { type Provider, type TestConnectionResponse } from "@app/shared-types/api-keys";
/**
 * Calls `conversation-service`'s per-provider "test connection" endpoint (AC-85),
 * sending `apiKey` once in the `X-Llm-Api-Key` header (AC-81/AC-82/AC-83 contract) —
 * never in the request body, and never persisted here or on the server.
 *
 * Network failures and non-2xx responses are normalized into a `{ success: false,
 * message }` result rather than throwing, so the UI always has a clear failure reason
 * to show (AC-85) instead of an unhandled rejection.
 */
export declare function testConnection(provider: Provider, apiKey: string): Promise<TestConnectionResponse>;
