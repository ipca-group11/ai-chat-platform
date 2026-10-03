import { z } from "zod";
import { providerSchema } from "./schema";
/**
 * Request DTO for the "Test connection" action (AC-85). The raw key itself is NOT
 * part of the body — it is sent once in the `LLM_API_KEY_HEADER` header (see
 * `schema.ts`), matching how send-message requests carry the key (AC-81, AC-82).
 */
export declare const testConnectionRequestSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        openai: "openai";
        anthropic: "anthropic";
        ollama: "ollama";
    }>;
}, z.core.$strip>;
export type TestConnectionRequest = z.infer<typeof testConnectionRequestSchema>;
/**
 * Response DTO for the "Test connection" action. `message` carries a clear,
 * human-readable failure reason when `success` is `false` (AC-85).
 */
export declare const testConnectionResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TestConnectionResponse = z.infer<typeof testConnectionResponseSchema>;
/**
 * Builds the `conversation-service` route path used to test a provider's API key,
 * e.g. `/providers/openai/test-connection`. A single constant shared by
 * `mfe-settings` (caller) and `conversation-service` (implementer) keeps both sides
 * in sync (AC-85).
 */
export declare function buildTestConnectionPath(provider: z.infer<typeof providerSchema>): string;
/**
 * Route (within `mfe-settings`) that manages provider API keys. Shared so
 * `mfe-chat`'s "no key configured" message can link back to the same place both mfes
 * agree on (AC-86).
 */
export declare const SETTINGS_ROUTE_PATH = "/settings";
