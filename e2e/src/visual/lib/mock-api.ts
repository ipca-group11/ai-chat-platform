import type { Page, Route } from "@playwright/test";
import { CHATS, MESSAGES, USER } from "./data.js";

/**
 * Answers every API call of the app with fixed JSON (AICHAT-39). No backend runs during the
 * visual tests: the shell asks `/auth/me` and the chat remote asks `/api/chats...`, both on the
 * origin that serves the shell, so `page.route` sees them. A request that no handler knows is
 * answered with 501 and recorded in `unexpected`, so a new API call cannot slip in unseen.
 */

export interface ApiScenario {
  /** Is there a session? `false` answers `/auth/me` with 401 (login and register screens). */
  signedIn: boolean;
  /** Chats returned by `GET /api/chats`. */
  chats: readonly object[];
  /** Messages returned by `GET /api/chats/:id/messages`. */
  messages: readonly object[];
}

export const SIGNED_OUT: ApiScenario = { signedIn: false, chats: [], messages: [] };
export const EMPTY_CHATS: ApiScenario = { signedIn: true, chats: [], messages: [] };
export const WITH_CHATS: ApiScenario = { signedIn: true, chats: CHATS, messages: MESSAGES };

const json = (route: Route, body: unknown, status = 200): Promise<void> =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** What the mock answers for one request, as plain data (also used by the unit tests). */
export function answer(scenario: ApiScenario, method: string, pathname: string): { status: number; body: unknown } | undefined {
  if (method === "GET" && pathname === "/auth/me") {
    return scenario.signedIn
      ? { status: 200, body: { id: USER.id, email: USER.email } }
      : { status: 401, body: { message: "Unauthorized" } };
  }
  if (method === "GET" && pathname === "/api/chats") return { status: 200, body: { chats: scenario.chats } };
  const chat = /^\/api\/chats\/([^/]+)$/.exec(pathname);
  if (method === "GET" && chat) {
    const found = scenario.chats.find((c) => (c as { id: string }).id === chat[1]);
    return found ? { status: 200, body: { chat: found } } : { status: 404, body: { message: "Not found" } };
  }
  const messages = /^\/api\/chats\/([^/]+)\/messages$/.exec(pathname);
  if (method === "GET" && messages) {
    return { status: 200, body: { messages: scenario.messages.filter((m) => (m as { chatId: string }).chatId === messages[1]) } };
  }
  if (method === "GET" && /^\/api\/chats\/[^/]+\/members$/.test(pathname)) {
    return { status: 200, body: { members: [{ email: USER.email, role: "owner", addedAt: "2026-03-01T09:00:00.000Z" }] } };
  }
  return undefined;
}

/** The shell's own origin: where the app sends `/auth` and `/api` calls. */
export const SHELL_ORIGIN = "http://localhost:5000";

const isApiUrl = (url: URL): boolean => url.origin === SHELL_ORIGIN && /^\/(api|auth)\//.test(url.pathname);

/** Installs the mock on `page`; returns the list that collects the requests nobody handled. */
export async function installApiMocks(page: Page, scenario: ApiScenario): Promise<string[]> {
  const unexpected: string[] = [];
  await page.route(isApiUrl, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    // The chat stream stays open and silent: the screens show saved messages, not live ones.
    if (request.method() === "GET" && pathname.endsWith("/stream")) {
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" });
      return;
    }
    const reply = answer(scenario, request.method(), pathname);
    if (!reply) {
      unexpected.push(`${request.method()} ${pathname}`);
      await json(route, { message: "Not mocked" }, 501);
      return;
    }
    await json(route, reply.body, reply.status);
  });
  return unexpected;
}
