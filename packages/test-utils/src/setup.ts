// Vitest setup file for every project that mocks HTTP with MSW:
//   test: { setupFiles: ["./src/test/setup.ts", "@platform/test-utils/setup"] }
// It starts the shared server before the tests, drops the per-test overrides after each test
// and stops the server at the end. A request that no handler describes fails the test.
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());
