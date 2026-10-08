/**
 * AICHAT-184: the committed `openapi.json` is generated from the Zod schemas and must never go
 * stale. Regenerate it with `pnpm openapi:generate` (Vitest `-u` rewrites the file snapshot).
 */
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { listRoutes } from "../test-utils/route-inventory.js";
import { buildOpenApiDocument } from "./document.js";

const doc = buildOpenApiDocument();
const METHODS = ["get", "post", "put", "patch", "delete"] as const;

interface Operation {
  security?: unknown[];
  responses: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
}

function operations(): [string, Operation][] {
  return Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
    METHODS.flatMap((method) => {
      const operation = (item as Record<string, Operation | undefined>)[method];
      return operation ? [[`${method.toUpperCase()} ${path}`, operation] as [string, Operation]] : [];
    }),
  );
}

describe("auth-service OpenAPI spec", () => {
  it("the committed openapi.json matches the schemas (run `pnpm openapi:generate` after a change)", async () => {
    await expect(`${JSON.stringify(doc, null, 2)}\n`).toMatchFileSnapshot("../../openapi.json");
  });

  it("is OpenAPI 3.1", () => {
    expect(doc.openapi).toBe("3.1.0");
  });

  it("documents every route the app registers, and no route that does not exist", () => {
    const documented = operations().map(([name]) => name.replace(/\{(\w+)\}/g, ":$1"));
    expect(documented.sort()).toEqual(listRoutes(buildTestApp().app));
  });

  it("declares the cookie that each route reads", () => {
    const security = Object.fromEntries(operations().map(([name, operation]) => [name, operation.security]));
    expect(security).toEqual({
      "GET /health": [],
      "GET /metrics": [],
      "POST /auth/register": [],
      "POST /auth/login": [],
      "POST /auth/refresh": [{ refreshCookie: [] }],
      "POST /auth/logout": [{ refreshCookie: [] }, {}],
      "GET /auth/me": [{ cookieAuth: [] }],
      "DELETE /auth/me": [{ cookieAuth: [] }],
    });
  });

  it("describes every error response with the shared error envelope", () => {
    const errorBodies = operations().flatMap(([name, operation]) =>
      Object.entries(operation.responses)
        .filter(([status]) => Number(status) >= 400)
        .map(([status, response]) => [`${name} ${status}`, response.content?.["application/json"]?.schema?.$ref] as const),
    );
    expect(errorBodies.length).toBeGreaterThan(8);
    for (const [name, ref] of errorBodies) expect(ref, name).toBe("#/components/schemas/ErrorResponse");
  });

  it("never documents a 500: a server error is always a bug, never an expected answer", () => {
    for (const [name, operation] of operations()) expect(Object.keys(operation.responses), name).not.toContain("500");
  });
});
