import { OpenAPIRegistry, OpenApiGeneratorV31, zodToOpenAPIRegistry, type ResponseConfig, type RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { deleteAccountRequestSchema, loginRequestSchema, registerRequestSchema } from "../shared/contracts/auth.js";
import { CORRELATION_HEADER, errorResponseSchema } from "../shared/contracts/http.js";
import { healthResponseSchema, sessionUserSchema } from "../shared/contracts/responses.js";

/**
 * OpenAPI 3.1 description of auth-service, built from the same Zod schemas the routes use
 * (AICHAT-184). Each route lists only the error statuses it can really return; a 500 is never
 * documented. `openapi.spec.ts` keeps the committed `openapi.json` in step with this file.
 */

/** Names a schema in `components/schemas`; every place that uses it becomes a `$ref`. It records the
 * name on the existing instance: `registry.register()` would need `.openapi()`, which Zod 4 only adds to
 * schemas created after `extendZodWithOpenApi`, and the contracts are created before. */
function named<T extends z.ZodType>(name: string, schema: T): T {
  zodToOpenAPIRegistry.add(schema, { _internal: { refId: name } });
  return schema;
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "Invalid request: `VALIDATION_ERROR` with `fieldErrors`, or `INVALID_JSON` for a body that is not JSON",
  401: "Missing or invalid credentials, session or refresh token",
  403: "The request comes from an origin that is not allowed",
  409: "An account with this email already exists",
  502: "conversation-service did not erase the account's data; nothing was deleted",
  413: "The JSON body is over the 100 kB limit (`PAYLOAD_TOO_LARGE`)",
  429: "Too many requests from this client (`RATE_LIMITED`)",
  503: "Account deletion is not configured on this deployment",
};

const correlationHeader = {
  [CORRELATION_HEADER]: { description: "Echoes the request's correlation id, or a new one", schema: { type: "string" as const } },
};
const setCookieHeader = {
  ...correlationHeader,
  "Set-Cookie": { description: "`access_token` (path /) and `refresh_token` (path /auth), both httpOnly, SameSite=Lax", schema: { type: "string" as const } },
};
const clearCookieHeader = {
  ...correlationHeader,
  "Set-Cookie": { description: "Expires both auth cookies", schema: { type: "string" as const } },
};

function json(description: string, schema: z.ZodType, headers: ResponseConfig["headers"] = correlationHeader): ResponseConfig {
  return { description, headers, content: { "application/json": { schema } } };
}

function errors(...statuses: number[]): Record<number, ResponseConfig> {
  return Object.fromEntries(statuses.map((status) => [status, json(ERROR_DESCRIPTIONS[status] ?? "Error", errorResponseSchema)]));
}

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31["generateDocument"]>;

named("ErrorResponse", errorResponseSchema);
named("SessionUser", sessionUserSchema);

/** Every route with its request schemas and, per status, its response schema. The spec is built from
 * this list and the response validation tests (`response-schemas.spec.ts`) read the same list. */
export function routeConfigs(): RouteConfig[] {
  const routes: RouteConfig[] = [];
  const route = (config: RouteConfig) => routes.push(config);

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
  route({
    operationId: "register",
    method: "post",
    path: "/auth/register",
    tags: ["auth"],
    summary: "Create an account (does not sign in)",
    security: [],
    request: { body: { required: true, content: { "application/json": { schema: registerRequestSchema } } } },
    responses: { 201: json("The new account", sessionUserSchema), ...errors(400, 409) },
  });
  route({
    operationId: "login",
    method: "post",
    path: "/auth/login",
    tags: ["auth"],
    summary: "Sign in; the tokens come back as httpOnly cookies",
    description: "An invalid body is answered like wrong credentials (401), never with field errors, so a caller cannot learn which field was wrong (AC-36).",
    security: [],
    request: { body: { required: true, content: { "application/json": { schema: loginRequestSchema } } } },
    responses: { 200: json("Signed in", sessionUserSchema, setCookieHeader), ...errors(401) },
  });
  route({
    operationId: "refresh",
    method: "post",
    path: "/auth/refresh",
    tags: ["auth"],
    summary: "Rotate the refresh token and issue a new access token",
    security: [{ refreshCookie: [] }],
    responses: { 204: { description: "New cookies set", headers: setCookieHeader }, ...errors(401) },
  });
  route({
    operationId: "logout",
    method: "post",
    path: "/auth/logout",
    tags: ["auth"],
    summary: "Sign out: revoke the refresh token, clear the cookies and stop the user's replies",
    security: [{ refreshCookie: [] }, {}],
    responses: { 204: { description: "Signed out (also without a session)", headers: clearCookieHeader } },
  });
  route({
    operationId: "getCurrentUser",
    method: "get",
    path: "/auth/me",
    tags: ["auth"],
    summary: "The signed-in user",
    security: [{ cookieAuth: [] }],
    responses: { 200: json("The user", sessionUserSchema), ...errors(401) },
  });
  route({
    operationId: "deleteAccount",
    method: "delete",
    path: "/auth/me",
    tags: ["auth"],
    summary: "Erase the account and everything it owns; the password is asked again",
    security: [{ cookieAuth: [] }],
    request: { body: { required: true, content: { "application/json": { schema: deleteAccountRequestSchema } } } },
    responses: {
      204: { description: "Erased; cookies cleared", headers: clearCookieHeader },
      ...errors(400, 401, 403, 502, 503),
    },
  });

  for (const config of routes) {
    // The body parser refuses a malformed or oversized JSON body before the route runs (AICHAT-186);
    // on login too, which otherwise answers every bad body with 401.
    if (config.request?.body) Object.assign(config.responses, errors(400, 413));
    // The app-wide rate limiter runs before every route, so any of them can answer 429.
    Object.assign(config.responses, errors(429));
  }
  return routes;
}

export function buildOpenApiDocument(): OpenApiDocument {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "access_token",
    description: "Access token (JWT, 15 min) set by login and refresh",
  });
  registry.registerComponent("securitySchemes", "refreshCookie", {
    type: "apiKey",
    in: "cookie",
    name: "refresh_token",
    description: "Refresh token (7 days), only sent to /auth",
  });

  for (const config of routeConfigs()) registry.registerPath(config);

  return new OpenApiGeneratorV31(registry.definitions, { sortComponents: "alphabetically" }).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "auth-service",
      version: "1.0.0",
      description: "Accounts and sessions. Generated from the Zod schemas; do not edit by hand.",
    },
    servers: [{ url: "http://localhost:4001", description: "Local service (the shell proxies /auth to it)" }],
  });
}
