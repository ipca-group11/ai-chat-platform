# Provider fixtures

Raw response bytes the adapter tests replay (`src/test-utils/replay.ts`). Nothing here is
fetched at test time; the tests never touch the network.

## Recorded

Written by `node scripts/record-llm-fixtures.ts` from a local Ollama (OpenAI-compatible
`/v1/chat/completions` and Anthropic-compatible `/v1/messages`). Ids, request ids,
timestamps and keys are replaced by placeholders.

| Fixture | Scenario |
|---|---|
| `anthropic/text.sse`, `anthropic/max-tokens.sse` | text then `end_turn`; `stop_reason: max_tokens` |
| `openai/text.sse`, `openai/max-tokens.sse` | text then `stop`; `finish_reason: length` |

Ollama does not send `ping` events, so the Anthropic recordings have none.

## Hand-written

Everything else is written by hand from the provider documentation, because a local model
cannot produce it (thinking, signatures, `pause_turn`, provider errors). Each file has a
sidecar `<file>.source.txt` that starts with `hand-written from <doc URL>`.

## Re-recording

Manual only, never in CI. See `docs/AICHAT-25/WORKLOG.md` (US1) for the commands and for
recording against the real APIs with keys. Review the git diff before committing.

## Known defects the replay shows

The tests assert today's behaviour and carry an `it.todo` for the expected one.

| Ticket | Defect | Fixtures |
|---|---|---|
| [AICHAT-211](https://ipca-grupo11.atlassian.net/browse/AICHAT-211) | OpenAI mid-stream errors are swallowed, a failed answer looks complete | `openai/error-midstream.sse` |
| [AICHAT-212](https://ipca-grupo11.atlassian.net/browse/AICHAT-212) | `max_tokens` / `length` truncation is not surfaced | `anthropic/max-tokens.sse`, `openai/max-tokens.sse` |
