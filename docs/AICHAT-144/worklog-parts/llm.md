### US4 · LLM mock: Anthropic Messages API streaming ([AICHAT-145](https://ipca-grupo11.atlassian.net/browse/AICHAT-145))

**What and why.** `POST /anthropic/v1/messages` now answers like the real Messages API, so conversation-service can stream from the mock instead of a paid account. With `"stream": true` it sends the full event sequence: `message_start`, `content_block_start`, a `ping`, one `content_block_delta` per token, `content_block_stop`, `message_delta` (with the stop reason and the output tokens) and `message_stop`. Without `stream` it returns the whole message as JSON. The text is paced by `TTFT_MS` (first token) and `TOKEN_INTERVAL_MS` (each next token), and its length is `TOKENS`.

Scenarios of this story (chosen with the `X-Mock-Scenario` header, see US6): `ok`, `long` (ten times `TOKENS`), `thinking` (a `thinking` block with `thinking_delta` and `signature_delta` before the text), `web-fetch` (a text block, a `server_tool_use` block named `web_fetch` with `input_json_delta`, a `web_fetch_tool_result` block, then the answer), `pause-turn` (stops with `pause_turn` after the web fetch; when the request already ends with an assistant turn, which is how the adapter resumes, it answers with plain text and `end_turn`) and `max-tokens` (stop reason `max_tokens`).

The shared logic lives in `src/llm/` and not in the router, so the backend mock can reuse it:

```ts
// src/llm/stream.ts
streamScenarioText(
  scenario: string,                       // "ok", "long", "max-tokens", ...
  ctx: Pick<MockContext, "config">,       // TTFT_MS, TOKEN_INTERVAL_MS, TOKENS and SEED are read from here
  options?: { signal?: AbortSignal },
): AsyncGenerator<string, void>           // one text token per step, already paced
```

It throws `UnknownScenarioError` for a name that is not a text scenario.

**Files.**
- `testing/mock-server/src/llm/text.ts`, `pacer.ts`, `scenarios.ts`, `stream.ts` (new): seeded text, pacing, the scenario table and `streamScenarioText`.
- `testing/mock-server/src/llm/anthropic.ts`, `sse.ts`, `select.ts` (new): the content blocks and SSE frames of a reply, SSE helpers, scenario selection.
- `testing/mock-server/src/routers/anthropic.router.ts`: the route.
- `testing/mock-server/src/llm/stream.spec.ts`, `src/routers/anthropic.router.spec.ts` (new) and `src/app.spec.ts`: tests.

**How to run.**

```sh
pnpm exec nx test mock-server
PORT=4110 pnpm exec nx serve mock-server
```

**How to repeat it manually.**

1. Start the server as above.
2. Run `curl -N localhost:4110/anthropic/v1/messages -H content-type:application/json -d '{"model":"claude-sonnet-4-5","max_tokens":100,"stream":true,"messages":[{"role":"user","content":"hi"}]}'`.
3. Add `-H 'X-Mock-Scenario: thinking'`, `web-fetch` or `pause-turn` to see the other blocks; leave out `"stream":true` for the JSON message.
4. Expected output: the events listed above, one every `TOKEN_INTERVAL_MS`, ending with `message_stop`.

**Result.** The plain stream has the full event sequence and ends with `end_turn`. The `thinking` stream has the thinking block and its signature before the text. The `web-fetch` stream has the tool call, its result and the answer, and `pause-turn` ends with `pause_turn`. The non-streaming call returns the message as JSON.

![Anthropic stream](evidence/10-anthropic-stream.png)

![Anthropic thinking block](evidence/11-anthropic-thinking.png)

![Anthropic web fetch, pause_turn and JSON answer](evidence/12-anthropic-web-fetch.png)

**Problems and fixes.** Random choices come from the seeded generator, but a generator that is shared by all requests would give a different text to each one, so the answer text is generated from `SEED` and the scenario name instead (see US6). The existing admin test expected an empty scenario list, so it now builds the app without mocks.

### US5 · LLM mock: OpenAI Chat Completions streaming ([AICHAT-146](https://ipca-grupo11.atlassian.net/browse/AICHAT-146))

**What and why.** `POST /openai/v1/chat/completions` streams `chat.completion.chunk` objects: a first chunk with the `assistant` role, one chunk per token, a last chunk with an empty `delta` and `finish_reason`, and the `data: [DONE]` line. `stream_options.include_usage` adds the usage chunk. Without `stream` the route returns a `chat.completion` object. The scenarios `ok`, `long` and `max-tokens` exist for this provider; `max-tokens` ends with `finish_reason: "length"`. The thinking and web fetch scenarios are Anthropic only, so OpenAI answers 400 for them.

**Files.**
- `testing/mock-server/src/llm/openai.ts` (new): reply, chunks and the non-streaming object.
- `testing/mock-server/src/routers/openai.router.ts`: the route.
- `testing/mock-server/src/routers/openai.router.spec.ts` (new): tests.

**How to run.**

```sh
pnpm exec nx test mock-server
```

**How to repeat it manually.**

1. Start the server (`PORT=4110 pnpm exec nx serve mock-server`).
2. Run `curl -N localhost:4110/openai/v1/chat/completions -H content-type:application/json -d '{"model":"gpt-4o","stream":true,"messages":[{"role":"user","content":"hi"}]}'`.
3. Add `-H 'X-Mock-Scenario: max-tokens'` for the `length` stop.
4. Expected output: the chunks, then a chunk with `"finish_reason":"stop"` (or `"length"`), then `data: [DONE]`.

**Result.** Both streams end with the finish chunk and `[DONE]`; the `max-tokens` stream finishes with `length`.

![OpenAI stream](evidence/13-openai-stream.png)

![OpenAI length stop](evidence/14-openai-max-tokens.png)

**Problems and fixes.** None. The real OpenAI adapter in conversation-service reads both mocks without changes: a throw-away script ran `AnthropicProvider` and `OpenAiProvider` against the running mock for the plain, thinking, web fetch, pause-turn, error and drop scenarios, and each gave the expected chunks or error (the contract tests story will make this a real test).

### US6 · LLM mock: per-request scenario selection ([AICHAT-147](https://ipca-grupo11.atlassian.net/browse/AICHAT-147))

**What and why.** A request picks its scenario in one of two ways: the `X-Mock-Scenario` header, or a suffix on the model name after `@` (`claude-sonnet-4-5@thinking`, `gpt-4o@max-tokens`), which is handy because the adapters only let us set the model. The header wins over the suffix, no choice means `ok`, and the model is echoed back without the suffix. A name that does not exist answers 400 and lists the names that do. Every mock registers its scenarios, and `GET /__admin/scenarios` lists them with a description. The text of an answer depends only on `SEED` and the scenario, so the same `SEED` gives the same answer on every request, and another `SEED` gives another one.

**Files.**
- `testing/mock-server/src/llm/select.ts`: header and suffix selection, list of names for the error message.
- `testing/mock-server/src/routers/anthropic.router.ts`, `openai.router.ts`: use the selection.
- `testing/mock-server/src/llm/scenarios.spec.ts` (new): tests for selection, the admin list and `SEED`.

**How to run.**

```sh
pnpm exec nx test mock-server
SEED=42 PORT=4110 pnpm exec nx serve mock-server
```

**How to repeat it manually.**

1. Start the server.
2. Run `curl -s localhost:4110/__admin/scenarios`.
3. Run `curl -s localhost:4110/openai/v1/chat/completions -H content-type:application/json -d '{"model":"gpt-4o@max-tokens","messages":[]}'` and the same call three times without the suffix.
4. Expected output: the list of scenarios per mock; `finish_reason` `length` for the suffix; the same text three times.

**Result.** The list shows the scenarios of both mocks, the suffix gives the `length` stop, and the three calls return the same text.

![Scenario list](evidence/15-scenario-list.png)

![Model suffix and SEED](evidence/16-scenario-suffix-and-seed.png)

**Problems and fixes.** Our first idea was to draw the text from the shared `ctx.rng`, but that generator moves on with every request, so the second call would have differed from the first. The text now comes from its own generator started from `SEED` and the scenario name; `ctx.rng` still makes the message and request ids, and `/__admin/reset` brings it back to the start.

### US7 · LLM mock: provider errors and broken streams ([AICHAT-148](https://ipca-grupo11.atlassian.net/browse/AICHAT-148))

**What and why.** Error scenarios answer before any stream starts, with the status, headers and body each provider uses. Anthropic: `error-401` (`authentication_error`), `error-429` (`rate_limit_error`, with `retry-after`), `error-500` (`api_error`) and `error-529` (`overloaded_error`), with `request_id` in the body and the `request-id` header. OpenAI: `error-401` (`invalid_api_key`), `error-429` (`rate_limit_exceeded`, with `retry-after`), `error-500` (`server_error`) and `error-503`, because OpenAI never answers 529 and signals overload with 503. The bodies follow the AICHAT-25 recordings. `retry-after` is 2 seconds so a retry test stays fast. `drop` sends half of the answer and then closes the connection with no closing event (no `message_stop`, no `[DONE]`), also for requests without `stream`. `slow` waits 5 seconds longer than `TTFT_MS` before the first token and then goes at the normal pace.

**Files.**
- `testing/mock-server/src/llm/errors.ts` (new): the error table, bodies and headers.
- `testing/mock-server/src/llm/scenarios.ts`, `anthropic.ts`, `openai.ts`, `stream.ts`, `sse.ts`: `drop` and `slow` in the plan, the replies and `streamScenarioText`.
- `testing/mock-server/src/routers/anthropic.router.ts`, `openai.router.ts`: error answers, drop and delay.
- `testing/mock-server/src/llm/faults.spec.ts` (new): tests.

**How to run.**

```sh
pnpm exec nx test mock-server
```

**How to repeat it manually.**

1. Start the server.
2. Run `curl -si localhost:4110/anthropic/v1/messages -H content-type:application/json -H 'X-Mock-Scenario: error-429' -d '{"messages":[]}'`; repeat with `error-401`, `error-500` and `error-529`.
3. Run the streaming call with `X-Mock-Scenario: drop` and check `echo ${PIPESTATUS[0]}`.
4. Time the first line of a stream with and without `X-Mock-Scenario: slow`.
5. Expected output: the status and body of each error, `retry-after: 2` on the 429; curl exit code 18 for `drop`; about 0.3 s against about 5.3 s for `slow`.

**Result.** The 429 carries `retry-after`, and the other errors have the provider body. The dropped stream stops after half of the tokens and curl reports a partial transfer (exit code 18). The first token takes 0.29 s in the normal case and 5.26 s with `slow`.

![Anthropic 429 with retry-after](evidence/17-error-429.png)

![401, 500 and 529 bodies, OpenAI 429](evidence/18-errors-401-500-529.png)

![Dropped stream](evidence/19-drop.png)

![First token with and without slow](evidence/20-slow.png)

**Problems and fixes.** The first version of `drop` called `res.destroy()` right after writing the last token, and the client sometimes received nothing at all because the data was still waiting in the socket. The mock now waits for the last write to be flushed and then closes the connection. The delay of `slow` is tested on the token generator with fake timers; doing the same over a real socket is not reliable, so the router only gets the check by hand (evidence above).

### US8 · LLM mock: replay recorded provider streams ([AICHAT-149](https://ipca-grupo11.atlassian.net/browse/AICHAT-149))

**What and why.** The scenario `replay:<fixture>` (header or model suffix) serves a stream recorded in AICHAT-25 byte for byte: `replay:thinking` on the Anthropic route sends `anthropic/thinking.sse`, and `replay:reasoning` on the OpenAI route sends `openai/reasoning.sse`. That includes the recordings that break halfway (`overloaded-midstream`, `error-midstream`). The file is cut into its SSE frames and sent with the usual pacing, and the frames put together are exactly the bytes of the file (the read uses latin1 so bytes that are not UTF-8 survive). The fixtures are not copied into the mock project: the folder is `FIXTURES_DIR`, or by default `services/conversation-service/src/test-utils/fixtures/llm` found from the repo root (the folder with `pnpm-workspace.yaml`). The Dockerfile copies that folder to `/app/fixtures` and sets `FIXTURES_DIR` to it. A fixture that does not exist answers 404 in the provider error shape, with the name and the list of fixtures that exist. Names with a slash or `..` are never read from disk.

**Files.**
- `testing/mock-server/src/llm/replay.ts`, `serve-replay.ts` (new): folder lookup, fixture read, frame splitting, the response.
- `testing/mock-server/src/config.ts`, `.env.example`: `FIXTURES_DIR`.
- `testing/mock-server/src/routers/anthropic.router.ts`, `openai.router.ts`: handle `replay:` first.
- `testing/mock-server/Dockerfile`: copies the fixtures into the image.
- `testing/mock-server/src/llm/replay.spec.ts` (new): byte-for-byte checks of 11 recordings, 404, path tricks, `FIXTURES_DIR`.

**How to run.**

```sh
pnpm exec nx run-many -t lint typecheck test build -p mock-server conversation-service
```

**How to repeat it manually.**

1. Start the server (`PORT=4110 pnpm exec nx serve mock-server`).
2. Run `curl -sN localhost:4110/anthropic/v1/messages -H content-type:application/json -H 'X-Mock-Scenario: replay:thinking' -d '{"messages":[]}' > out.sse`.
3. Run `cmp out.sse services/conversation-service/src/test-utils/fixtures/llm/anthropic/thinking.sse`.
4. Repeat with `replay:nope`.
5. Expected output: `cmp` prints nothing (identical files); the unknown fixture answers 404 with the list of fixtures.

**Result.** `cmp` finds no difference for the three recordings tried, including the one that ends with an error event. The missing fixture gives a 404 that says what is available. Lint, typecheck, tests (coverage above 80% on all four metrics) and build pass for mock-server and conversation-service.

![Replay compared with cmp](evidence/21-replay-byte-compare.png)

![Missing fixture](evidence/22-replay-missing.png)

![Lint, typecheck, test and build](evidence/23-llm-mock-checks.png)

**Problems and fixes.** The adapters resume a `pause_turn` by sending the request again, but a recording is a fixed file, so `replay:pause-turn-1` ends the turn paused; the second half is served by asking for `replay:pause-turn-2`. The image was built again and `replay:text` answered from `/app/fixtures` inside the container.
