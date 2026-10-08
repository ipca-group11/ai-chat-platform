/**
 * AICHAT-186: invalid requests are refused with the error envelope, never a 500. Each row is one bad
 * request; `field` is the key expected in `fieldErrors`. Login is the one exception to "400 with
 * field errors": a bad body is answered like wrong credentials (401) so a caller never learns which
 * field was wrong (AC-36). Every response is also checked against the OpenAPI route table.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ErasureClient } from "../shared/erasure-client.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { createResponseChecker } from "../test-utils/documented-response.js";
import { cookieNamed, loginVia, PASSWORD, registerVia } from "../test-utils/session-helpers.js";

const { expectDocumentedResponse } = createResponseChecker();
const erasure: ErasureClient = { eraseUser: async () => {} };

interface Case {
  route: "POST /auth/register" | "POST /auth/login" | "DELETE /auth/me";
  name: string;
  /** A JSON body, or a raw string sent as `application/json`. */
  body: object | string;
  status?: number;
  code?: string;
  field?: string;
}

const user = { email: "new@example.com", password: PASSWORD };

const CASES: Case[] = [
  { route: "POST /auth/register", name: "missing field", body: { password: PASSWORD }, field: "email" },
  { route: "POST /auth/register", name: "wrong type", body: { ...user, password: 12345678 }, field: "password" },
  { route: "POST /auth/register", name: "password too short", body: { ...user, password: "abc1" }, field: "password" },
  { route: "POST /auth/register", name: "password without a number", body: { ...user, password: "onlyletters" }, field: "password" },
  { route: "POST /auth/register", name: "not an email", body: { ...user, email: "nope" }, field: "email" },
  { route: "POST /auth/register", name: "extra field", body: { ...user, role: "admin" }, field: "role" },
  { route: "POST /auth/register", name: "malformed JSON", body: '{"email":', code: "INVALID_JSON" },
  { route: "POST /auth/register", name: "body over the 100 kB limit", body: { ...user, email: `${"x".repeat(110_000)}@example.com` }, status: 413, code: "PAYLOAD_TOO_LARGE" },
  { route: "POST /auth/login", name: "missing field (401 on purpose, AC-36)", body: { email: "ana@example.com" }, status: 401, code: "INVALID_CREDENTIALS" },
  { route: "POST /auth/login", name: "wrong type (401 on purpose, AC-36)", body: { email: 42, password: PASSWORD }, status: 401, code: "INVALID_CREDENTIALS" },
  { route: "POST /auth/login", name: "extra field (401 on purpose, AC-36)", body: { email: "ana@example.com", password: PASSWORD, admin: true }, status: 401, code: "INVALID_CREDENTIALS" },
  { route: "POST /auth/login", name: "malformed JSON (refused before the route)", body: "{", code: "INVALID_JSON" },
  { route: "DELETE /auth/me", name: "missing field", body: {}, field: "password" },
  { route: "DELETE /auth/me", name: "too long", body: { password: "x".repeat(1025) }, field: "password" },
  { route: "DELETE /auth/me", name: "extra field", body: { password: PASSWORD, keepData: true }, field: "keepData" },
  { route: "DELETE /auth/me", name: "malformed JSON", body: "nope", code: "INVALID_JSON" },
];

describe("invalid requests are refused with the error envelope, never 500", () => {
  it.each(CASES.map((c) => [`${c.route} · ${c.name}`, c] as const))("%s", async (_title, c) => {
    const { app } = buildTestApp(undefined, { erasure });
    await registerVia(app, "ana@example.com");
    const access = cookieNamed(await loginVia(app, "ana@example.com"), "access_token");

    const [method, path] = c.route.split(" ") as ["POST" | "DELETE", string];
    let req = method === "POST" ? request(app).post(path) : request(app).delete(path).set("Cookie", access);
    req = typeof c.body === "string" ? req.set("Content-Type", "application/json") : req;
    const res = await req.send(c.body);

    expect(res.status, JSON.stringify(res.body)).toBe(c.status ?? 400);
    expect(res.body.error.code).toBe(c.code ?? "VALIDATION_ERROR");
    if (c.field) expect(Object.keys(res.body.error.fieldErrors ?? {})).toContain(c.field);
    if (c.route === "POST /auth/login") expect(res.body.error.fieldErrors).toBeUndefined();
    expectDocumentedResponse(c.route, res);
  });
});
