# Mock server usage guide

One small server stands in for everything the app talks to: the LLM providers, auth-service, conversation-service, the MFE remotes and the telemetry collector. It lives in `testing/mock-server` (package `@platform/mock-server`) and the other testing epics (AICHAT-18, 19, 21, 24, 26, 28, 32) reuse it instead of building their own fakes. Everything is deterministic: the same `SEED` gives the same text, ids and timings.

## 1. Run it

| Where | Command | Result |
|---|---|---|
| Plain Node, for tests and scripts | `pnpm --filter @platform/mock-server serve` | Server on `http://localhost:4010` |
| With watch mode | `pnpm --filter @platform/mock-server dev` | Same, restarts on a change |
| In a test (no port) | `createApp(loadConfig({ ... })).app` with supertest | See `testing/mock-server/src/routers/*.spec.ts` |
| Docker, real stack plus the LLM mock | `pnpm mock:up` (profile `llm`) | App on `http://localhost:8000`, mock on `:4010`; conversation-service calls the mock instead of Anthropic / OpenAI |
| Docker, frontend only | `bash scripts/mock-compose.sh up frontend-only` | Shell and MFEs against the backend mock, no database |
| Stop the Docker stack | `pnpm mock:down` | Removes containers and volumes |
| Local dev servers against the mock | `pnpm dev:mock` | Vite dev servers on `:5000`-`:5003`, mock on `:4010`, no database |
| Image only | `docker build -f testing/mock-server/Dockerfile -t ai-chat-mock-server .` | Image that listens on `4010` |

The Docker profiles are defined in `compose.mock.yaml` on top of `compose.yaml` (`docker compose -f compose.yaml -f compose.mock.yaml --profile llm up`). The plain `docker compose up` is unchanged.

Sign-in on the backend mock (profile `frontend-only`, `pnpm dev:mock`): `alice@mock.test` with password `Mock-pass-1234` (dataset `default`). Any text works as a provider API key.

## 2. Mocks

| Mock | Mount path | Stands in for | Notes |
|---|---|---|---|
| anthropic | `/anthropic/v1/messages` | api.anthropic.com Messages API | Streaming and non-streaming; thinking, web fetch, `pause_turn`, errors, dropped streams, replay |
| openai | `/openai/v1/chat/completions` | api.openai.com Chat Completions | Streaming and non-streaming; errors, dropped streams, replay |
| auth | `/auth/*` | auth-service | `register`, `login`, `refresh`, `logout`, `me`; session in httpOnly cookies, real error shape |
| conversation | `/api/*` | conversation-service behind the shell's `/api` proxy | Chats, members, messages, retry, stop, attachments, `GET /chats/:id/stream` (SSE), `POST /providers/:provider/test-connection` |
| remotes | `/remotes/<scenario>/remoteEntry.js` | The MFE remote entries | Valid, slow, missing and broken remotes |
| collect | `/collect` | Grafana Faro collector (Alloy) | Answers 202; payloads are kept in the request log |
| admin | `/__admin/*` | (control, not a mock) | See section 5 |

## 3. Scenario tables

A scenario is picked per request. LLM mocks: model name suffix (`claude-sonnet-4-5@thinking`) or the `X-Mock-Scenario` header, the header wins; the default is `ok`. Chat mock: the `X-Mock-Scenario` header on `POST /api/chats/:id/messages` and `/retry`. The current list is always at `GET /__admin/scenarios`.

### anthropic and openai

| Scenario | Providers | What happens |
|---|---|---|
| `ok` | both | Answer of `TOKENS` tokens, stop reason `end_turn` |
| `long` | both | Ten times `TOKENS` |
| `thinking` | anthropic | Thinking block (with signature) before the answer |
| `web-fetch` | anthropic | Answer through a `web_fetch` server tool call and its result |
| `pause-turn` | anthropic | Stops with `pause_turn`; the continuation request ends with `end_turn` |
| `max-tokens` | both | Cut short: `max_tokens` (`length` on OpenAI) |
| `drop` | both | Connection closes halfway, no closing event |
| `slow` | both | First token 5000 ms later than `TTFT_MS` |
| `error-401` | both | `authentication_error` / `invalid_api_key` |
| `error-429` | both | Rate limit, `retry-after: 2` |
| `error-500` | both | `api_error` / `server_error` |
| `error-529` | anthropic | `overloaded_error` |
| `error-503` | openai | `server_error` (overloaded) |
| `replay:<fixture>` | both | Serves `<FIXTURES_DIR>/<provider>/<fixture>.sse` byte for byte (the AICHAT-25 recordings) |

### auth and conversation

| Scenario | Mock | What happens |
|---|---|---|
| `ok` | conversation | Streamed answer of `TOKENS` tokens (text from the LLM mock `ok`) |
| `long` | conversation | Ten times as long (text from the LLM mock `long`) |
| `error` | conversation | Answer fails after two tokens; the message ends `failed` and can be retried |
| `truncated` | conversation | Answer cut off at the output token limit (text from the LLM mock `max-tokens`); `done` has `truncated: true` and the message `truncated: true` (AICHAT-212) |
| `session-expired` | auth, conversation | 401 `UNAUTHENTICATED`; the auth mock also clears the cookies |
| `error-500` | auth, conversation | 500 `INTERNAL_ERROR` |
| `slow` | auth, conversation | Answer held back 3 s (or `delayMs` of the fault) |
| `stream-drop` | conversation | Chat stream is cut after 3 events |

Faults on routes are set with `POST /__admin/faults` (section 5), for example `{ "route": "GET /auth/me", "scenario": "session-expired", "times": 1 }`.

### remotes

| Scenario | URL | What happens |
|---|---|---|
| `ok` | `/remotes/ok/remoteEntry.js` | Valid remote entry |
| `slow` | `/remotes/slow/remoteEntry.js?delayMs=3000` | Valid entry after a delay |
| `404` | `/remotes/404/remoteEntry.js` | Not found |
| `broken-js` | `/remotes/broken-js/remoteEntry.js` | 200 with JavaScript that does not parse |

### Datasets

`empty` (default), `default`, `many-chats` (220 chats), `long-conversation` (500 messages), `shared-chats`, `attachments`. Load at start with `MOCK_DATASET` or at any time with `POST /__admin/seed/<dataset>`. The factories and datasets can be imported without the server: `import { createFactories, buildDataset } from "@platform/mock-server"`.

## 4. Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4010` | Port the server listens on |
| `LATENCY_MS` | `0` | Fixed delay on every mock response |
| `TTFT_MS` | `200` | LLM mocks and chat stream: time to first token |
| `TOKEN_INTERVAL_MS` | `20` | LLM mocks and chat stream: gap between tokens |
| `TOKENS` | `40` | Tokens of a default answer |
| `ERROR_RATE` | `0` | Share (0 to 1) of mock requests that fail with 500 at random |
| `SEED` | `1` | Seed of the generator (number or any text) |
| `MOCK_DATASET` | `empty` | Dataset loaded at start and after `/__admin/reset` |
| `FIXTURES_DIR` | the AICHAT-25 recordings | Folder with `anthropic/*.sse` and `openai/*.sse` for `replay:` |

On the real conversation-service (profile `llm`): `ANTHROPIC_BASE_URL=http://mock-server:4010/anthropic` and `OPENAI_BASE_URL=http://mock-server:4010/openai`. In the compose files the mock settings are `MOCK_DATASET`, `MOCK_SEED`, `MOCK_TTFT_MS`, `MOCK_TOKEN_INTERVAL_MS`, `MOCK_TOKENS`, `MOCK_LATENCY_MS`, `MOCK_ERROR_RATE` and `MOCK_SERVER_PORT` (published port, default 4010).

## 5. Admin endpoints

| Endpoint | Use |
|---|---|
| `GET /__admin/health` | Health check |
| `GET /__admin/scenarios` | Every registered scenario with its description |
| `POST /__admin/seed/<dataset>` | Load a dataset |
| `GET /__admin/data` | The current records |
| `GET /__admin/requests[?mock=<name>]` | Requests the mocks received (secrets masked) |
| `POST /__admin/faults`, `GET`, `DELETE` | Set, list and clear faults on routes |
| `POST /__admin/reset` | Back to the start-up state: dataset, random generator, faults, request log, running answers |

## 6. Examples per testing epic

Start with `pnpm --filter @platform/mock-server serve` unless the example says otherwise.

### AICHAT-18 Component testing

Build the component's data from the factories, with no server:

```ts
import { createFactories, buildDataset } from "@platform/mock-server";
const f = createFactories("my-test");            // same seed, same ids
const chat = f.chat({ title: "Welcome" });
const data = buildDataset("long-conversation");  // 500 messages for a virtualised list
```

For a component that fetches, point it at `http://localhost:4010/api` and load a dataset with `POST /__admin/seed/shared-chats`.

### AICHAT-19 Visual regression testing

Same `SEED` and dataset give the same screen every run, so screenshots do not flicker.

```sh
SEED=7 MOCK_DATASET=default TTFT_MS=0 TOKEN_INTERVAL_MS=0 pnpm --filter @platform/mock-server serve
```

Use `many-chats` for the sidebar, `attachments` for the file chips, `curl -X POST :4010/__admin/seed/<dataset>` between screens.

### AICHAT-21 Performance testing (frontend)

Control the load the page gets: a long list, a fast or a slow stream, a slow remote.

```sh
MOCK_DATASET=long-conversation TOKENS=400 TOKEN_INTERVAL_MS=5 pnpm --filter @platform/mock-server serve
# slow remote: /remotes/slow/remoteEntry.js?delayMs=2000
```

### AICHAT-24 Load testing

Aim k6 at the LLM mock so load never reaches a provider, and add failures:

```sh
LATENCY_MS=20 ERROR_RATE=0.02 TOKENS=200 TTFT_MS=100 pnpm --filter @platform/mock-server serve
k6 run -e BASE=http://localhost:4010 load.js        # POST $BASE/anthropic/v1/messages with "stream": true
```

For the whole service under load, `pnpm mock:up` and send chat messages to conversation-service (`:4002`); the provider side is the mock. `error-429` and `error-529` check how retries behave under load.

### AICHAT-26 Prompt injection testing

The mock never obeys the prompt, so the test checks what the app sends and shows. Read what reached the provider and check the answer is rendered as text:

```sh
curl -s 'localhost:4010/__admin/requests?mock=anthropic' | jq '.requests[-1].body.messages'
curl -s localhost:4010/anthropic/v1/messages -H 'content-type: application/json' \
  -d '{"model":"claude-sonnet-4-5@replay:text","messages":[{"role":"user","content":"hi"}]}'
```

Put the hostile text in a `.sse` file under `FIXTURES_DIR` and serve it with `replay:<fixture>` to test how the UI shows tool calls, HTML and links coming back from a model.

### AICHAT-28 DAST

Run the scanner against the backend mocks, which answer in the real error shape and set the same cookies as the services, without a database or a provider key:

```sh
MOCK_DATASET=default pnpm --filter @platform/mock-server serve
zap-baseline.py -t http://localhost:4010/api -r zap.html     # with a session cookie from POST /auth/login
```

`session-expired` and `error-500` faults show how the scanner copes with 401 and 500.

### AICHAT-32 PII masking testing

The telemetry sink keeps what the browser sends, and the request log masks secrets in what it stores. Point the app's Faro URL at `http://localhost:4010/collect`, use the app, then:

```sh
curl -s 'localhost:4010/__admin/requests?mock=collect' | jq '.requests[].body'
```

Check that emails, message text and API keys are not in the payloads. `GET /__admin/requests?mock=conversation` shows the same for API calls (the `x-llm-api-key` header and any field called key, token, password or secret is `***`).

## 7. Checks that keep the mock honest

- Contract tests (`testing/mock-server/src/contract`): the real LLM adapters of conversation-service parse every LLM scenario, and the backend mock responses are validated against the service schemas and `@platform/shared-types`. New drift fails CI. The known differences between shared-types and the services are in the work log (US15).
- The E2E workflow runs the chat flows against the `llm` profile (US17 in the work log).
