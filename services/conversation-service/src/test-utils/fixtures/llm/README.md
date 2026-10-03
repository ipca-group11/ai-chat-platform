# Provider fixtures

Raw response bytes the adapter tests replay (`src/test-utils/replay.ts`). Nothing here is
fetched at test time; the tests never touch the network.

## Recorded

Written by `node scripts/record-llm-fixtures.mjs` from a local Ollama (OpenAI-compatible
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
