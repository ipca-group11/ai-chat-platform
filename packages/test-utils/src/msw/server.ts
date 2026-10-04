import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** The shared MSW server. `@platform/test-utils/setup` starts and stops it; tests only add overrides. */
export const server = setupServer(...handlers);

/**
 * Records every request the code under test makes from now on, in order. Use it to assert that a
 * call was (or was not) made, and what it carried; the array is filled as requests arrive.
 * The listener is removed after the test by `@platform/test-utils/setup`.
 *
 *   const requests = recordRequests();
 *   ...
 *   expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /auth/logout"]);
 */
export function recordRequests(): Request[] {
  const seen: Request[] = [];
  server.events.on("request:start", ({ request }) => {
    seen.push(request.clone());
  });
  return seen;
}
