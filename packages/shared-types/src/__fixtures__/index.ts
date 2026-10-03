import type { z } from "zod";
import { accessTokenClaimsSchema } from "../auth/jwt";
import { authResponseSchema, userProfileSchema } from "../auth/dto";
import { testConnectionResponseSchema } from "../api-keys/test-connection";
import { attachmentSchema } from "../chat/attachment";
import { chatMemberSchema, chatSchema } from "../chat/chat";
import { messageSchema } from "../chat/message";
import {
  sseDoneEventSchema,
  sseErrorEventSchema,
  sseQueuedEventSchema,
  sseReasoningEventSchema,
  sseTokenEventSchema,
  sseWebFetchEventSchema,
} from "../chat/sse";
import { errorResponseSchema, toErrorResponse } from "../http/error-response";

/**
 * Canonical example of every DTO listed in docs/AICHAT-20/README.md section 4.2. Each
 * entry pairs a schema with one valid input, so the fixture test can run `schema.parse`
 * on all of them and the snapshot tests can serialise the parsed output.
 *
 * Ids are real UUIDs and dates are real ISO strings on purpose: the snapshot serializer
 * replaces them, and these fixtures prove it does.
 */
export interface Fixture<S extends z.ZodType = z.ZodType> {
  schema: S;
  input: z.input<S>;
}

function fixture<S extends z.ZodType>(schema: S, input: z.input<S>): Fixture<S> {
  return { schema, input };
}

const USER_ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const CHAT_ID = "7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6";
const MESSAGE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ATTACHMENT_ID = "c0ffee00-1234-4abc-9def-0123456789ab";
const CREATED_AT = "2026-10-03T09:15:30.000Z";
const UPDATED_AT = "2026-10-03T09:20:45.123Z";

const webFetch = {
  id: "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b",
  url: "https://example.com/article",
  status: "done",
  title: "Example article",
} as const;

export const fixtures = {
  userProfile: fixture(userProfileSchema, {
    id: USER_ID,
    email: "ana@example.com",
    createdAt: CREATED_AT,
  }),
  authResponse: fixture(authResponseSchema, {
    user: { id: USER_ID, email: "ana@example.com", createdAt: CREATED_AT },
  }),
  accessTokenClaims: fixture(accessTokenClaimsSchema, {
    sub: USER_ID,
    email: "ana@example.com",
    iat: 1_790_000_000,
    exp: 1_790_000_900,
  }),
  chat: fixture(chatSchema, {
    id: CHAT_ID,
    ownerId: USER_ID,
    title: "Weekly planning",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    reasoning: false,
    webFetch: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  }),
  chatMember: fixture(chatMemberSchema, {
    email: "ana@example.com",
    role: "owner",
    addedAt: CREATED_AT,
  }),
  message: fixture(messageSchema, {
    id: MESSAGE_ID,
    chatId: CHAT_ID,
    role: "assistant",
    content: "Here is the summary you asked for.",
    reasoning: "The user wants a short summary.",
    webFetches: [webFetch],
    status: "complete",
    attachmentIds: [ATTACHMENT_ID],
    createdAt: CREATED_AT,
  }),
  attachment: fixture(attachmentSchema, {
    id: ATTACHMENT_ID,
    messageId: MESSAGE_ID,
    ownerId: USER_ID,
    originalFilename: "notes.pdf",
    storedPath: "uploads/ana/notes.pdf",
    mimeType: "application/pdf",
    size: 20480,
    extractedTextStatus: "extracted",
    createdAt: CREATED_AT,
  }),
  sseToken: fixture(sseTokenEventSchema, { type: "token", messageId: MESSAGE_ID, token: "Hel" }),
  sseReasoning: fixture(sseReasoningEventSchema, {
    type: "reasoning",
    messageId: MESSAGE_ID,
    token: "Thinking",
  }),
  sseWebFetch: fixture(sseWebFetchEventSchema, {
    type: "web_fetch",
    messageId: MESSAGE_ID,
    fetch: webFetch,
  }),
  sseDone: fixture(sseDoneEventSchema, { type: "done", messageId: MESSAGE_ID }),
  sseError: fixture(sseErrorEventSchema, {
    type: "error",
    messageId: MESSAGE_ID,
    message: "provider timeout",
  }),
  sseQueued: fixture(sseQueuedEventSchema, { type: "queued", messageId: MESSAGE_ID, position: 2 }),
  errorResponse: fixture(
    errorResponseSchema,
    toErrorResponse("VALIDATION_ERROR", "Request validation failed", {
      fieldErrors: { email: ["Invalid email address"] },
      correlationId: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
    }),
  ),
  testConnectionResponse: fixture(testConnectionResponseSchema, {
    success: false,
    message: "The provider rejected the API key",
  }),
} satisfies Record<string, Fixture>;

export type FixtureName = keyof typeof fixtures;
