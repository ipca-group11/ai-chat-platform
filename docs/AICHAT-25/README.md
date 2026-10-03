---
title: "AICHAT-25 · [Foundations] Provider adapter testing with recorded responses ★"
---

# AICHAT-25 · [Foundations] Provider adapter testing with recorded responses ★

| Field | Value |
|---|---|
| Jira | [AICHAT-25](https://ipca-grupo11.atlassian.net/browse/AICHAT-25) |
| Type / label | Epic / `testing` · ★ architecture-specific risk (LLM streaming) |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-24 (mock LLM can replay the same fixtures), unassigned "Error mapping testing" |
| Layer | LLM layer (`services/conversation-service/src/features/llm-adapters`) |

## 1. Goal

Replay **recorded** Anthropic and OpenAI SSE streams through the adapters, covering **text, thinking, `pause_turn`,
`max_tokens` and errors** for each provider, with **no network calls**. This protects the core streaming path without API cost.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** Fixture set in §5 (Anthropic and OpenAI) confirmed in scope
- [ ] **Tooling agreed:** Vitest, recorded `.sse`/`.json` fixtures, replay helper and no-network setup file confirmed
- [ ] Target environment available
- [ ] Recorded Anthropic and OpenAI SSE fixtures → **none exist (§4.3)**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Replay covers text, thinking, `pause_turn`, `max_tokens` and errors per provider
- [ ] No network calls

## 3. Technologies

| Tool | Role |
|---|---|
| Vitest `5.0.1` | Runner; `vi.stubGlobal("fetch", …)` in a setup file to **fail any real network call** |
| Adapter `fetchImpl` injection | Both adapters take `{ baseUrl, fetchImpl }`, so tests can pass a replaying `fetch` |
| Web Streams (`ReadableStream`, `Response`) | Built into Node ≥ 18; replay a fixture as a real `Response` body |
| Fixture files `*.sse` / `*.json` | Raw `text/event-stream` bodies and `{status, body}` HTTP errors |
| Recording script (to build) | Node script that calls the real APIs once (with a key, outside CI) and saves raw bytes |
| Optional: **Polly.js** / **nock** recording | Generic HTTP record/replay; not needed because the adapters already accept `fetchImpl` |

## 4. Discovery: current state

### 4.1 Adapter behaviour (what the fixtures must exercise)
- **Anthropic** (`anthropic.provider.ts`, POST `/v1/messages`): handles `error` events (retryable `ProviderError`), `content_block_start` (incl. `web_fetch_tool_result`), deltas `text_delta`, `thinking_delta`, `signature_delta`, `citations_delta`, `input_json_delta`; `content_block_stop` emits web-fetch "fetching"; `message_delta` records `stop_reason`; **`pause_turn` is resumed** by re-posting the reply so far (max 3 continuations). HTTP 429 and 5xx are retryable.
- **OpenAI** (`openai.provider.ts`, POST `/v1/chat/completions`): yields only `choices[0].delta.content`; reasoning text is never streamed by Chat Completions; no web fetch.
- Shared: `http-stream.ts` (`readLines`, `readSseData`, stops at `[DONE]`).

### 4.2 Existing tests
- `anthropic.provider.spec.ts` (24 tests), `openai.provider.spec.ts` (11), `http-stream.spec.ts` (5), `registry.spec.ts` (3).
- Streams are **hand-written inline** (`mockStreamResponse([...])` in `test-utils/mock-stream.ts`), **one SSE event per chunk**, and without `event:` lines, `ping` events, `message_start` or realistic ids. Real network chunking (cuts mid-line or inside a multi-byte UTF-8 character) is never exercised.
- `pause_turn` and thinking are tested with inline events; `max_tokens` is not tested; OpenAI mid-stream errors are not tested.
- **No guard against real network calls.** An adapter built without `fetchImpl` would use the global `fetch`.

### 4.3 Report-worthy defects found while reading the adapters
1. **OpenAI mid-stream errors are swallowed.** If OpenAI sends `data: {"error": {...}}` after the 200, the adapter finds no `choices` and ends the stream normally, so a failed answer looks complete.
2. **`max_tokens` / `length` truncation is not surfaced** by either adapter. Anthropic stores `stop_reason` but only uses it for `pause_turn`; OpenAI ignores `finish_reason`. The user sees a cut-off answer marked as done.
3. **Text attachments never reach the model.** `attachments/llm-context.ts` builds `{kind:"text"}` items, but both adapters keep only images (`anthropic.provider.ts:322`, `openai.provider.ts:94`).
4. Anthropic `refusal` stop reason is ignored as well.

(No code was changed during discovery; these are follow-up tickets for the chat owner. Replay tests make 1 and 2 visible.)

## 5. Fixture set to record

| Provider | Fixture | Scenario |
|---|---|---|
| Anthropic | `text.sse` | `message_start`, `ping`, text deltas, `end_turn` |
| Anthropic | `thinking.sse` | thinking block (thinking + signature deltas), then text |
| Anthropic | `pause-turn-1.sse` + `pause-turn-2.sse` | `server_tool_use` web_fetch with `input_json_delta`, `web_fetch_tool_result`, `pause_turn`; continuation finishes |
| Anthropic | `web-fetch-error.sse` | `web_fetch_tool_result` with `web_fetch_tool_error` (`url_not_accessible`) |
| Anthropic | `max-tokens.sse` | text then `stop_reason: max_tokens` |
| Anthropic | `overloaded-midstream.sse` | partial text then `event: error` `overloaded_error` |
| Anthropic | `http-400/401/429/529.json` | `invalid_request_error`, `authentication_error`, `rate_limit_error`, `overloaded_error` |
| OpenAI | `text.sse` | role chunk, content chunks, `finish_reason: stop`, `[DONE]` |
| OpenAI | `reasoning.sse` | `o4-mini` with `reasoning_effort`; only content streamed |
| OpenAI | `max-tokens.sse` | `finish_reason: length` |
| OpenAI | `error-midstream.sse` | content then `data: {"error": …}` |
| OpenAI | `http-400/401/429/500.json` | `unsupported_value`, `invalid_api_key`, `rate_limit_exceeded`, `server_error` |

## 6. Implementation plan (steps)

1. **Recording script** `scripts/record-llm-fixtures.ts`: takes `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` from env, sends one small prompt per scenario (e.g. "17×23" with thinking on; a web-fetch prompt for `pause_turn`; `max_tokens: 10` for truncation), and writes the **raw response bytes** to `src/test-utils/fixtures/llm/<provider>/`. It removes ids/keys it should not keep. Error fixtures that can't be triggered on demand (529, mid-stream errors) are **built from the documented wire format** and marked as synthetic in a `fixtures/llm/README.md`.
2. **Replay helper** `src/test-utils/replay.ts`: `replaySse(provider, name)` returns a real `Response` whose body is split into **uneven byte chunks** (1, 7, 64, 3, … bytes) so line and UTF-8 boundaries are exercised; `replayHttpError()`; `replayFetch(...responses)` returns them in order and records the requests (for `pause_turn` continuation checks).
3. **No-network guard:** a Vitest `setupFiles` entry that stubs global `fetch` to throw "Network access is disabled in tests".
4. **Spec** `recorded-replay.spec.ts`: one test per fixture, asserting the exact chunk sequence (text, reasoning, web_fetch), the continuation request body for `pause_turn`, and `ProviderError` `{statusCode, retryable, message}` for each error fixture (table-driven).
5. Report defects 1–2 (§4.3); once fixed, the max_tokens and mid-stream-error tests assert the new behaviour.
6. Document: how to re-record (needs keys, run manually, review the diff), and the "synthetic" marking.

## 7. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-46](https://ipca-grupo11.atlassian.net/browse/AICHAT-46) | AICHAT-25-US1 | As a developer, I want a script that records real provider streams so that fixtures match the real wire format | Script records the §5 success scenarios for both providers; secrets and ids stripped; documented | 3 |
| [AICHAT-64](https://ipca-grupo11.atlassian.net/browse/AICHAT-64) | AICHAT-25-US2 | As a developer, I want a replay helper that splits fixtures at arbitrary byte offsets so that the parser is tested like on a real network | `replaySse`, `replayHttpError`, `replayFetch` in `test-utils`; UTF-8 split case passes | 2 |
| [AICHAT-82](https://ipca-grupo11.atlassian.net/browse/AICHAT-82) | AICHAT-25-US3 | As a team, I want tests to fail on any real network call so that CI never spends API credits | Vitest setup file stubs `fetch`; a test proves it throws | 1 |
| [AICHAT-99](https://ipca-grupo11.atlassian.net/browse/AICHAT-99) | AICHAT-25-US4 | As a developer, I want replay tests for text, thinking, pause_turn, max_tokens and errors for both providers | All §5 fixtures replayed with exact assertions | 5 |
| [AICHAT-117](https://ipca-grupo11.atlassian.net/browse/AICHAT-117) | AICHAT-25-US5 | As a user, I want a truncated or failed answer to be shown as such, not as complete | Tickets raised for OpenAI mid-stream errors and max_tokens truncation; tests updated once fixed | 2 |

## 8. Risks and open decisions

- Recording needs real API keys and costs a few cents. Run it manually, never in CI.
- Provider wire formats change (new event types such as `citations_delta`). Re-record each quarter or when upgrading API versions (`anthropic-version: 2023-06-01`).
- Fixtures must not contain API keys or personal data. The script must scrub `request_id`/`id` values.

## 9. Notes for the report

The adapters are already well unit-tested (43 tests), but every stream is **hand-written, one event per chunk**, so
realistic network chunking and the full event sequence are never tested. Reading the adapters to plan the fixtures found
**two user-visible defects** (OpenAI mid-stream errors swallowed; `max_tokens` truncation shown as a finished
answer) and one functional gap (text attachments dropped before the model). The plan records real streams once, replays
them in uneven byte chunks, and blocks all network access in the test run.
