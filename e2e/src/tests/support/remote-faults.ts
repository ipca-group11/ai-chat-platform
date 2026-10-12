import type { Page, Route } from "@playwright/test";

/**
 * Fails or delays exactly one Module Federation remote (AICHAT-161).
 *
 * The shell fetches the `remoteEntry.js` of all three remotes on every page load (to agree on the
 * shared libraries), then the chunks of the route being opened. Each remote is served from its own
 * origin, so the fault is matched on the origin: blocking `mfeChat` leaves `mfeAuth` and
 * `mfeSettings` untouched, which a pattern like `/remoteEntry/` would not.
 *
 * The origins come from the same variables the shell is built with (`VITE_MFE_*_URL`); the
 * defaults are the ports `compose.yaml` publishes.
 */
export type RemoteName = "mfeAuth" | "mfeChat" | "mfeSettings";

export interface RemoteInfo {
  /** Scope name the shell gives the remote: `remote-loading-<scope>`, `remote-fallback-<scope>`. */
  scope: string;
  origin: string;
  /** A page of the shell that mounts this remote. */
  path: string;
  /** Test id of an element the remote renders on that page once it has loaded. */
  ready: string;
}

export const remotes: Record<RemoteName, RemoteInfo> = {
  mfeAuth: {
    scope: "auth",
    origin: process.env["VITE_MFE_AUTH_URL"] ?? "http://localhost:3001",
    path: "/login",
    ready: "sign-in",
  },
  mfeChat: {
    scope: "chat",
    origin: process.env["VITE_MFE_CHAT_URL"] ?? "http://localhost:3002",
    path: "/chats",
    ready: "new-chat",
  },
  mfeSettings: {
    scope: "settings",
    origin: process.env["VITE_MFE_SETTINGS_URL"] ?? "http://localhost:3003",
    path: "/settings",
    ready: "settings-heading",
  },
};

export const remoteNames = Object.keys(remotes) as RemoteName[];

/**
 * - `abort`: the network fails (`net::ERR_FAILED`), as when the remote's host is down.
 * - `http-500`: the server answers with an error page instead of the script.
 * - `{ delayMs }`: the request goes through after a pause, as on a slow network.
 * - `hang`: the request never gets an answer until `restore()`.
 */
export type FaultMode = "abort" | "http-500" | { delayMs: number } | "hang";

/**
 * - `all`: `remoteEntry.js` and every chunk, the whole remote is down.
 * - `chunks`: only the files `remoteEntry.js` loads next; the entry itself still loads, as when
 *   a remote is redeployed and the chunk names it advertised no longer exist.
 */
export type FaultFiles = "all" | "chunks";

/** True when `url` is one of the files of the remote served at `origin`. */
export function matchesRemote(url: string | URL, origin: string, files: FaultFiles = "all"): boolean {
  const target = new URL(url);
  if (target.origin !== new URL(origin).origin) return false;
  return files === "all" || target.pathname !== "/remoteEntry.js";
}

export interface RemoteFault {
  /** Removes the fault; requests held by `hang` or a delay go through. */
  restore(): Promise<void>;
}

export async function failRemote(
  page: Page,
  remote: RemoteName,
  mode: FaultMode,
  files: FaultFiles = "all",
): Promise<RemoteFault> {
  const { origin } = remotes[remote];
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));

  const matcher = (url: URL) => matchesRemote(url, origin, files);
  const handler = async (route: Route) => {
    if (mode === "abort") return route.abort("failed");
    if (mode === "http-500") {
      return route.fulfill({ status: 500, contentType: "text/plain", body: `${remote} is down` });
    }
    const wait =
      mode === "hang" ? released : Promise.race([released, new Promise((r) => setTimeout(r, mode.delayMs))]);
    await wait;
    // The page may have navigated or closed while the request was held.
    await route.continue().catch(() => undefined);
  };

  await page.route(matcher, handler);
  return {
    async restore() {
      await page.unroute(matcher, handler);
      release();
    },
  };
}
