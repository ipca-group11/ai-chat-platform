import { OpenAPIRegistry, OpenApiGeneratorV31, zodToOpenAPIRegistry, type ResponseConfig, type RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { addMemberSchema, chatIdParamsSchema, createChatSchema, memberParamsSchema, updateChatSchema } from "../features/chats/schema.js";
import { attachmentParamsSchema } from "../features/attachments/schema.js";
import { eraseUserSchema } from "../features/erasure/schema.js";
import { sessionParamsSchema } from "../features/messages/internal-routes.js";
import { chatParamsSchema, editMessageSchema, messageParamsSchema, sendMessageSchema } from "../features/messages/schema.js";
import {
  attachmentDtoSchema,
  chatDtoSchema,
  chatMemberDtoSchema,
  messageDtoSchema,
  sseDoneEventSchema,
  sseErrorEventSchema,
  sseMessageEventSchema,
  sseQueuedEventSchema,
  sseReasoningEventSchema,
  sseStartedEventSchema,
  sseTokenEventSchema,
  sseWebFetchEventSchema,
  webFetchDtoSchema,
} from "../shared/contracts/chat.js";
import { CORRELATION_HEADER, errorResponseSchema, LLM_API_KEY_HEADER } from "../shared/contracts/http.js";
import {
  attachmentResponseSchema,
  chatListResponseSchema,
  chatResponseSchema,
  erasureResponseSchema,
  healthResponseSchema,
  memberListResponseSchema,
  memberResponseSchema,
  messageListResponseSchema,
  messageResponseSchema,
  sessionStopResponseSchema,
  stopResponseSchema,
} from "../shared/contracts/responses.js";

/**
 * OpenAPI 3.1 description of conversation-service, built from the same Zod schemas the routes
 * use (AICHAT-184). Each route lists only the error statuses it can really return: an
 * undocumented status (a 500 above all) is a failure for the response validation tests and
 * for Schemathesis. `openapi.spec.ts` keeps the committed `openapi.json` in step with this file.
 */

/** Names a schema in `components/schemas`; every place that uses it becomes a `$ref`. It records the
 * name on the existing instance: `registry.register()` would need `.openapi()`, which Zod 4 only adds to
 * schemas created after `extendZodWithOpenApi`, and the contracts are created before. */
function named<T extends z.ZodType>(name: string, schema: T): T {
  zodToOpenAPIRegistry.add(schema, { _internal: { refId: name } });
  return schema;
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "Invalid request: `VALIDATION_ERROR` with `fieldErrors`, or a specific code",
  401: "Missing or invalid credentials",
  403: "Not allowed for this member",
  404: "Not found, or not visible to the caller",
  409: "The resource is in a state that does not allow the change",
  422: "The chat's model cannot take this attachment",
};

const correlationHeader = {
  [CORRELATION_HEADER]: { description: "Echoes the request's correlation id, or a new one", schema: { type: "string" as const } },
};

function json(description: string, schema: z.ZodType): ResponseConfig {
  return { description, headers: correlationHeader, content: { "application/json": { schema } } };
}

function noContent(description: string): ResponseConfig {
  return { description, headers: correlationHeader };
}

function errors(...statuses: number[]): Record<number, ResponseConfig> {
  return Object.fromEntries(statuses.map((status) => [status, json(ERROR_DESCRIPTIONS[status] ?? "Error", errorResponseSchema)]));
}

const userAuth: RouteConfig["security"] = [{ cookieAuth: [] }, { bearerAuth: [] }];
const serviceAuth: RouteConfig["security"] = [{ serviceToken: [] }];
const apiKeyHeader = z.object({
  [LLM_API_KEY_HEADER.toLowerCase()]: z.string().optional().meta({ description: "Provider API key for this request only; never stored" }),
});

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31["generateDocument"]>;

named("ErrorResponse", errorResponseSchema);
named("Chat", chatDtoSchema);
named("ChatMember", chatMemberDtoSchema);
named("Message", messageDtoSchema);
named("Attachment", attachmentDtoSchema);
named("WebFetch", webFetchDtoSchema);
const sseEvent = named(
  "SseEvent",
  z.discriminatedUnion("type", [
    sseMessageEventSchema,
    sseTokenEventSchema,
    sseReasoningEventSchema,
    sseWebFetchEventSchema,
    sseQueuedEventSchema,
    sseStartedEventSchema,
    sseDoneEventSchema,
    sseErrorEventSchema,
  ]),
);

/** Every route with its request schemas and, per status, its response schema. The spec is built from
 * this list and the response validation tests (`response-schemas.spec.ts`) read the same list. */
export function routeConfigs(): RouteConfig[] {
  const routes: RouteConfig[] = [];
  const route = (config: RouteConfig) => routes.push(config);

  // --- operations ------------------------------------------------------------------------
  route({
    operationId: "getHealth",
    method: "get",
    path: "/health",
    tags: ["operations"],
    summary: "Liveness check",
    security: [],
    responses: { 200: json("The service is up", healthResponseSchema) },
  });
  route({
    operationId: "getMetrics",
    method: "get",
    path: "/metrics",
    tags: ["operations"],
    summary: "Prometheus metrics",
    security: [],
    responses: { 200: { description: "Prometheus text format", content: { "text/plain": { schema: z.string() } } } },
  });

  // --- chats -----------------------------------------------------------------------------
  route({
    operationId: "listChats",
    method: "get",
    path: "/chats",
    tags: ["chats"],
    summary: "Chats the caller owns or is a member of",
    security: userAuth,
    responses: { 200: json("The chats", chatListResponseSchema), ...errors(401) },
  });
  route({
    operationId: "createChat",
    method: "post",
    path: "/chats",
    tags: ["chats"],
    summary: "Create a chat",
    security: userAuth,
    request: { body: { required: true, content: { "application/json": { schema: createChatSchema } } } },
    responses: { 201: json("The new chat", chatResponseSchema), ...errors(400, 401) },
  });
  route({
    operationId: "getChat",
    method: "get",
    path: "/chats/{id}",
    tags: ["chats"],
    summary: "One chat",
    security: userAuth,
    request: { params: chatIdParamsSchema },
    responses: { 200: json("The chat", chatResponseSchema), ...errors(401, 404) },
  });
  route({
    operationId: "updateChat",
    method: "patch",
    path: "/chats/{id}",
    tags: ["chats"],
    summary: "Rename or change the model of a chat (owner only)",
    security: userAuth,
    request: { params: chatIdParamsSchema, body: { required: true, content: { "application/json": { schema: updateChatSchema } } } },
    responses: { 200: json("The updated chat", chatResponseSchema), ...errors(400, 401, 404) },
  });
  route({
    operationId: "deleteChat",
    method: "delete",
    path: "/chats/{id}",
    tags: ["chats"],
    summary: "Delete a chat (owner only)",
    security: userAuth,
    request: { params: chatIdParamsSchema },
    responses: { 204: noContent("Deleted"), ...errors(401, 404) },
  });
  route({
    operationId: "listMembers",
    method: "get",
    path: "/chats/{id}/members",
    tags: ["chats"],
    summary: "Members of a chat",
    security: userAuth,
    request: { params: chatIdParamsSchema },
    responses: { 200: json("The members, owner first", memberListResponseSchema), ...errors(401, 404) },
  });
  route({
    operationId: "addMember",
    method: "post",
    path: "/chats/{id}/members",
    tags: ["chats"],
    summary: "Invite a member by email (owner only)",
    security: userAuth,
    request: { params: chatIdParamsSchema, body: { required: true, content: { "application/json": { schema: addMemberSchema } } } },
    responses: { 201: json("The new member", memberResponseSchema), ...errors(400, 401, 404, 409) },
  });
  route({
    operationId: "removeMember",
    method: "delete",
    path: "/chats/{id}/members/{email}",
    tags: ["chats"],
    summary: "Remove a member (owner), or remove yourself",
    security: userAuth,
    request: { params: memberParamsSchema },
    responses: { 204: noContent("Removed"), ...errors(401, 403, 404) },
  });
  route({
    operationId: "leaveChat",
    method: "delete",
    path: "/chats/{id}/membership",
    tags: ["chats"],
    summary: "Leave a chat shared with you",
    security: userAuth,
    request: { params: chatIdParamsSchema },
    responses: { 204: noContent("Left the chat"), ...errors(401, 404) },
  });

  // --- messages --------------------------------------------------------------------------
  route({
    operationId: "listMessages",
    method: "get",
    path: "/chats/{chatId}/messages",
    tags: ["messages"],
    summary: "Message history of a chat",
    security: userAuth,
    request: { params: chatParamsSchema },
    responses: { 200: json("The messages, oldest first", messageListResponseSchema), ...errors(401, 404) },
  });
  route({
    operationId: "sendMessage",
    method: "post",
    path: "/chats/{chatId}/messages",
    tags: ["messages"],
    summary: "Send a message; the reply is queued and streamed",
    security: userAuth,
    request: {
      params: chatParamsSchema,
      headers: apiKeyHeader,
      body: { required: true, content: { "application/json": { schema: sendMessageSchema } } },
    },
    responses: { 201: json("The user message", messageResponseSchema), ...errors(400, 401, 404) },
  });
  route({
    operationId: "editQueuedMessage",
    method: "patch",
    path: "/chats/{chatId}/messages/{messageId}",
    tags: ["messages"],
    summary: "Edit a message that is still queued",
    security: userAuth,
    request: { params: messageParamsSchema, body: { required: true, content: { "application/json": { schema: editMessageSchema } } } },
    responses: { 200: json("The edited message", messageResponseSchema), ...errors(400, 401, 404, 409) },
  });
  route({
    operationId: "cancelQueuedMessage",
    method: "delete",
    path: "/chats/{chatId}/messages/{messageId}",
    tags: ["messages"],
    summary: "Cancel a message that is still queued",
    security: userAuth,
    request: { params: messageParamsSchema },
    responses: { 204: noContent("Canceled"), ...errors(401, 404, 409) },
  });
  route({
    operationId: "retryReply",
    method: "post",
    path: "/chats/{chatId}/messages/{messageId}/retry",
    tags: ["messages"],
    summary: "Retry a failed reply",
    security: userAuth,
    request: { params: messageParamsSchema, headers: apiKeyHeader },
    responses: { 202: json("The reply, queued again", messageResponseSchema), ...errors(401, 404, 409) },
  });
  route({
    operationId: "stopReply",
    method: "post",
    path: "/chats/{chatId}/stop",
    tags: ["messages"],
    summary: "Stop the reply being written; the partial text is kept",
    security: userAuth,
    request: { params: chatParamsSchema },
    responses: { 200: json("Whether a reply was running", stopResponseSchema), ...errors(401, 404) },
  });

  // --- streaming -------------------------------------------------------------------------
  route({
    operationId: "streamChat",
    method: "get",
    path: "/chats/{chatId}/stream",
    tags: ["streaming"],
    summary: "Server-sent events of a chat (never ends on its own)",
    description: "Each event is `event: <type>` followed by `data: <JSON>`; the JSON matches `SseEvent`.",
    security: userAuth,
    request: { params: chatParamsSchema },
    responses: {
      200: { description: "Event stream", headers: correlationHeader, content: { "text/event-stream": { schema: sseEvent } } },
      ...errors(401, 404),
    },
  });

  // --- attachments -----------------------------------------------------------------------
  route({
    operationId: "uploadAttachment",
    method: "post",
    path: "/chats/{chatId}/messages/{messageId}/attachments",
    tags: ["attachments"],
    summary: "Upload a file for a message (.txt, .pdf, .png, .jpeg; 10 MB by default)",
    security: userAuth,
    request: {
      params: attachmentParamsSchema,
      body: {
        required: true,
        content: { "multipart/form-data": { schema: z.object({ file: z.string().meta({ format: "binary" }) }) } },
      },
    },
    responses: { 201: json("The stored attachment", attachmentResponseSchema), ...errors(400, 401, 404, 422) },
  });

  // --- internal (auth-service only) ------------------------------------------------------
  route({
    operationId: "eraseUser",
    method: "post",
    path: "/internal/erasures",
    tags: ["internal"],
    summary: "Erase everything a deleted account owns (called by auth-service)",
    security: serviceAuth,
    request: { body: { required: true, content: { "application/json": { schema: eraseUserSchema } } } },
    responses: { 200: json("What was deleted", erasureResponseSchema), ...errors(400, 401) },
  });
  route({
    operationId: "stopUserReplies",
    method: "post",
    path: "/internal/sessions/{userId}/stop",
    tags: ["internal"],
    summary: "Stop every reply a user started (called by auth-service on logout)",
    security: serviceAuth,
    request: { params: sessionParamsSchema },
    responses: { 200: json("How many replies were stopped", sessionStopResponseSchema), ...errors(401) },
  });

  return routes;
}

export function buildOpenApiDocument(): OpenApiDocument {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "access_token",
    description: "Access token (JWT) set by auth-service as an httpOnly cookie",
  });
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "The same access token in an Authorization header (non-browser clients)",
  });
  registry.registerComponent("securitySchemes", "serviceToken", {
    type: "http",
    scheme: "bearer",
    description: "INTERNAL_SERVICE_TOKEN shared with auth-service; only for /internal routes",
  });

  for (const config of routeConfigs()) registry.registerPath(config);

  return new OpenApiGeneratorV31(registry.definitions, { sortComponents: "alphabetically" }).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "conversation-service",
      version: "1.0.0",
      description: "Chats, messages, attachments and the reply stream. Generated from the Zod schemas; do not edit by hand.",
    },
    servers: [{ url: "http://localhost:4002", description: "Local service (the shell proxies it under /api)" }],
  });
}
