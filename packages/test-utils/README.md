# `@platform/test-utils`

Shared Vitest helpers for the microfrontends (AICHAT-17: [AICHAT-51](https://ipca-grupo11.atlassian.net/browse/AICHAT-51), [AICHAT-135](https://ipca-grupo11.atlassian.net/browse/AICHAT-135)).
Plain TypeScript source, no build step: Vite and Vitest read it from the workspace link. It is test code, so it is not
on the unit-test exempt list; it has its own tests and the same 80% coverage bar as the other packages.

Add it to an app with `"@platform/test-utils": "workspace:*"` and `"msw": "^2.15.0"` in `devDependencies`, and put `"node"` in the
`types` of the app `tsconfig.json` (the mock-server factories pull in a shared module that imports `node:crypto`).

## Render helpers: `@platform/test-utils`

| Export | What it does |
|---|---|
| `renderWithClient(ui, options?)` | `render` inside a `QueryClientProvider`. Returns the Testing Library result plus `queryClient`. |
| `renderHookWithClient(hook, options?)` | `renderHook` inside a `QueryClientProvider`. Returns the Testing Library result plus `queryClient`. |
| `createTestQueryClient()` | A `QueryClient` with retries off for queries and mutations. |
| `withQueryClient(client?, Inner?)` | The wrapper component itself, for tests that still call Testing Library directly. |
| `installFakeEventSource()` | Replaces the global `EventSource` with `FakeEventSource` and clears its instances. |
| `FakeEventSource` | `instances`, `last`, `url`, `closed`, `emit(type, data)` (JSON unless a string), `emitTransportError()`. |

`options` are the Testing Library options plus `queryClient` (use your own client, for example one with seeded data) and `wrapper`
(providers that go inside the `QueryClientProvider`: router, auth context).

```tsx
const { queryClient } = renderWithClient(<ChatList onOpenChat={onOpen} />);
const { result } = renderHookWithClient(() => useChats(), { queryClient: seeded });

const Source = installFakeEventSource(); // in beforeEach; vi.unstubAllGlobals() in afterEach
ensureChatStream("chat-1", client);
Source.last.emit("token", { messageId: "m1", token: "Hi" });
```

## PII detector: `@platform/test-utils/pii`

For the telemetry tests of AICHAT-32 (service logs, `/metrics`, Faro). Node only, no DOM.

| Export | What it does |
|---|---|
| `findPii(text, { canaries?, ignore? })` | Matches `{ kind, value, index }` for emails, IPv4/IPv6 addresses, tokens (JWT, `Bearer`, session cookie values, `sk-` API keys) and your canaries. Percent-encoded text is scanned decoded too. `[REDACTED]` never matches. |
| `findPiiInLines(lines, options?)` | The same over many lines; each match has its `line`. |
| `describePii(matches)` | One readable line per match, for the assertion message. |
| `createLogCapture()` | A pino destination that keeps the lines: `lines()`, `records()`, `clear()`. |

```ts
const logs = createLogCapture();
const app = createApp({ ...deps, logger: pino(options, logs) });
// ...drive the routes...
expect(describePii(findPiiInLines(logs.lines(), { canaries: [CANARY] }))).toBe("");
```

## HTTP mocking with MSW: `@platform/test-utils/msw` and `/setup`

Add the setup file to the Vitest config of the project, after its own setup file:

```ts
test: { setupFiles: ["./src/test/setup.ts", "@platform/test-utils/setup"] }
```

It starts the shared server before the tests with `onUnhandledRequest: "error"` (a request nobody described fails the test),
drops the overrides and request recorders after each test, and stops the server at the end.

| Export | What it is |
|---|---|
| `server` | The shared `setupServer(...handlers)`. Use `server.use(...)` in a test to change one response. |
| `handlers`, `authHandlers`, `chatHandlers`, `messageHandlers`, `settingsHandlers` | Default handlers. Paths start with `*`, so any base URL matches (`/api`, `/auth`, a service URL). |
| `recordRequests()` | Returns an array that fills with every request made from now on (clones, so `await r.json()` works). |
| `http`, `HttpResponse`, `delay` | Re-exported from `msw`. |
| `fixtures` | The data behind the defaults, built with the `@platform/mock-server` factories (fixed seed, so ids and dates are stable). |
| `toChatDto`, `toMessageDto`, `toAttachmentDto` | Same mapping the mock server applies, to turn factory records into what conversation-service sends. |

Default endpoints: `POST /auth/register|login|refresh|logout`, `GET /auth/me`; `GET|POST /chats`, `GET|PATCH|DELETE /chats/:chatId`,
members (`GET|POST /chats/:chatId/members`, `DELETE .../members/:email`, `DELETE .../membership`);
`GET|POST /chats/:chatId/messages`, `PATCH|DELETE .../messages/:messageId`, `POST .../messages/:messageId/retry|stop`,
`POST /chats/:chatId/stop`, `POST /chats/:chatId/attachments`; `POST /providers/:provider/test-connection`.
Chats, messages and members use conversation-service's one-key envelope (`{ chat }`, `{ chats }`, `{ messages }`, `{ members }`).

```ts
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";

it("shows the server error", async () => {
  server.use(http.post("*/auth/login", () => HttpResponse.json({ error: "Invalid email or password" }, { status: 401 })));
  const requests = recordRequests();
  // ... act ...
  expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /auth/login"]);
});
```

### Known limits

- **File uploads.** Node's `fetch` cannot read a jsdom `FormData` that holds a jsdom `File` (`Cannot read properties of undefined (reading '_buffer')`),
  so an upload never reaches the server in a jsdom test. Stub `fetch` for that single call (see `usePendingAttachments.test.ts`).
- **Something that is not a response.** MSW answers with real responses or network errors (`HttpResponse.error()`). To make code
  see something else, spy on `fetch` for one call (see `TestConnectionButton.test.tsx`).
- **SSE.** The chat stream uses `EventSource`, which jsdom does not have; use `FakeEventSource`.
- **Backend tests** do not use MSW; they keep the fakes in `services/conversation-service/src/test-utils/`.
