/**
 * Guard (AICHAT-131): every route the app registers must have an integration test.
 * `ROUTE_TESTS` lists each route with the spec file that covers it; a test title in that
 * file must start with "METHOD /path". Adding a route without a test, or deleting the
 * test of an existing route, fails this suite.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { listRoutes } from "../test-utils/route-inventory.js";

const ROUTE_TESTS: Record<string, string> = {
  "GET /health": "routes.spec.ts",
  "GET /metrics": "routes.spec.ts",
  "GET /chats": "routes.spec.ts",
  "POST /chats": "routes.spec.ts",
  "GET /chats/:id": "routes.spec.ts",
  "PATCH /chats/:id": "routes.spec.ts",
  "DELETE /chats/:id": "routes.spec.ts",
  "GET /chats/:id/members": "routes.spec.ts",
  "POST /chats/:id/members": "routes.spec.ts",
  "DELETE /chats/:id/members/:email": "routes.spec.ts",
  "DELETE /chats/:id/membership": "routes.spec.ts",
  "GET /chats/:chatId/messages": "routes.spec.ts",
  "POST /chats/:chatId/messages": "routes.spec.ts",
  "PATCH /chats/:chatId/messages/:messageId": "routes.spec.ts",
  "DELETE /chats/:chatId/messages/:messageId": "routes.spec.ts",
  "POST /chats/:chatId/messages/:messageId/retry": "routes.spec.ts",
  "POST /chats/:chatId/stop": "routes.spec.ts",
  "GET /chats/:chatId/stream": "routes.spec.ts",
  "POST /chats/:chatId/messages/:messageId/attachments": "routes.spec.ts",
};

const here = dirname(fileURLToPath(import.meta.url));

function hasTestTitled(file: string, route: string): boolean {
  const source = readFileSync(resolve(here, file), "utf8");
  return source.split("\n").some((line) => /^\s*(it|test)\(\s*["'`]/.test(line) && line.includes(`"${route} `));
}

describe("route inventory", () => {
  const registered = listRoutes(buildTestApp().app);

  it("every registered route has an entry in ROUTE_TESTS", () => {
    const missing = registered.filter((route) => !(route in ROUTE_TESTS));
    expect(missing, `routes without an integration test entry: ${missing.join(", ")}`).toEqual([]);
  });

  it("ROUTE_TESTS has no entry for a route that no longer exists", () => {
    const stale = Object.keys(ROUTE_TESTS).filter((route) => !registered.includes(route));
    expect(stale, `entries for routes that do not exist: ${stale.join(", ")}`).toEqual([]);
  });

  it("each entry points to a spec with a test titled after the route", () => {
    const untested = Object.entries(ROUTE_TESTS)
      .filter(([route, file]) => !hasTestTitled(file, route))
      .map(([route]) => route);
    expect(untested, `no test titled "<route> …" found for: ${untested.join(", ")}`).toEqual([]);
  });
});
