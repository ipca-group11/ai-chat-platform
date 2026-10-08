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

/** `METHOD /path` of every documented operation, Express style (`{id}` -> `:id`). */
function documentedRoutes(): string[] {
  return Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
    METHODS.filter((method) => (item as Record<string, unknown>)[method]).map(
      (method) => `${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ":$1")}`,
    ),
  );
}

function operations(): [string, Operation][] {
  return Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
    METHODS.flatMap((method) => {
      const operation = (item as Record<string, Operation | undefined>)[method];
      return operation ? [[`${method.toUpperCase()} ${path}`, operation] as [string, Operation]] : [];
    }),
  );
}

describe("conversation-service OpenAPI spec", () => {
  it("the committed openapi.json matches the schemas (run `pnpm openapi:generate` after a change)", async () => {
    await expect(`${JSON.stringify(doc, null, 2)}\n`).toMatchFileSnapshot("../../openapi.json");
  });

  it("is OpenAPI 3.1", () => {
    expect(doc.openapi).toBe("3.1.0");
  });

  it("documents every route the app registers, and no route that does not exist", () => {
    const registered = listRoutes(buildTestApp().app);
    expect(documentedRoutes().sort()).toEqual(registered);
  });

  it("protects every chat route with the access-token cookie and every internal route with the service token", () => {
    for (const [name, operation] of operations()) {
      if (name.includes(" /chats")) expect(operation.security, name).toEqual([{ cookieAuth: [] }, { bearerAuth: [] }]);
      else if (name.includes(" /internal/")) expect(operation.security, name).toEqual([{ serviceToken: [] }]);
      else expect(operation.security, `${name} is public on purpose`).toEqual([]);
    }
  });

  it("describes every error response with the shared error envelope", () => {
    const errorBodies = operations().flatMap(([name, operation]) =>
      Object.entries(operation.responses)
        .filter(([status]) => Number(status) >= 400)
        .map(([status, response]) => [`${name} ${status}`, response.content?.["application/json"]?.schema?.$ref] as const),
    );
    expect(errorBodies.length).toBeGreaterThan(20);
    for (const [name, ref] of errorBodies) expect(ref, name).toBe("#/components/schemas/ErrorResponse");
  });

  it("never documents a 500: a server error is always a bug, never an expected answer", () => {
    for (const [name, operation] of operations()) expect(Object.keys(operation.responses), name).not.toContain("500");
  });
});
