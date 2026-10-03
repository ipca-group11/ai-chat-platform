import { Router, type Response } from "express";
import { sleep } from "../middleware.js";
import type { MockModule } from "../registry.js";

/** Delay of the `slow` remote when the request has no `?delayMs=`. */
export const DEFAULT_SLOW_MS = 3000;
const MAX_SLOW_MS = 60_000;

/** A small Module Federation container: exposes `./routes` with a default component. */
export const OK_REMOTE_ENTRY = `// mock remote container (mock-server)
const exposes = {
  "./routes": async () => ({ default: () => null, __mock: true }),
};
export async function init() {}
export async function get(module) {
  const factory = exposes[module];
  if (!factory) throw new Error("Module " + module + " is not exposed by the mock remote");
  return () => factory();
}
`;

/** Starts like a module and then breaks, so the browser rejects the import. */
export const BROKEN_REMOTE_ENTRY = `// mock remote container with a syntax error (mock-server)
const get = (module => {
  return ;;; this is not valid javascript }}}
`;

function sendScript(res: Response, status: number, body: string): void {
  res.status(status).type("application/javascript").send(body);
}

/** MFE remotes mock: `/remotes/<name>/remoteEntry.js` where `<name>` picks the behaviour. */
export const remotesMock: MockModule = {
  name: "remotes",
  mountPath: "/remotes",
  scenarios: [
    { mock: "remotes", name: "ok", description: "Valid remoteEntry.js answered at once" },
    { mock: "remotes", name: "slow", description: "Valid remoteEntry.js after a delay (default 3000 ms, ?delayMs=)" },
    { mock: "remotes", name: "404", description: "remoteEntry.js does not exist (404)" },
    { mock: "remotes", name: "broken-js", description: "remoteEntry.js answers 200 with invalid JavaScript" },
  ],
  createRouter() {
    const router = Router();

    router.get("/:name/remoteEntry.js", async (req, res) => {
      switch (req.params.name) {
        case "ok":
          sendScript(res, 200, OK_REMOTE_ENTRY);
          return;
        case "slow": {
          const asked = Number(req.query.delayMs);
          const delay = Number.isFinite(asked) && asked >= 0 ? Math.min(asked, MAX_SLOW_MS) : DEFAULT_SLOW_MS;
          await sleep(delay);
          sendScript(res, 200, OK_REMOTE_ENTRY);
          return;
        }
        case "broken-js":
          sendScript(res, 200, BROKEN_REMOTE_ENTRY);
          return;
        default:
          // `404`, and any name that is not a known behaviour.
          res.status(404).type("text/plain").send(`Remote "${req.params.name}" not found`);
      }
    });

    return router;
  },
};
