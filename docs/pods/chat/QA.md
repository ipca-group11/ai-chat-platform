# QA Report: chat pod

**Verdict: PASS**

## Scope

Verified `apps/mfe-chat` (chat list, chat view, composer, message queue,
attachments UI) and `services/conversation-service` (chats, messages, queue,
SSE streaming, LLM provider adapters, attachments) against acceptance
criteria AC-42..AC-74 (US-13..US-22) from `docs/BACKLOG.json`.

## Action taken

Found AC-50 ("All subsequent messages in that chat use the persisted
provider and model") had no test whose name included its id. Added
`AC-50: subsequent messages use the chat's persisted provider and model,
even after it changes` to
`services/conversation-service/src/features/messages/processor.spec.ts`.
It asserts that a first message uses the provider/model the chat was
created with, and — after the chat is updated to a different
provider/model — a subsequent message picks up the new persisted values
rather than a cached one. No application code was modified.

## Test commands run

- `services/conversation-service`: `npm run test` (vitest run --coverage) →
  **32 files, 175 tests passed** (was 174 before the added AC-50 test).
- `apps/mfe-chat`: `npm run test` (vitest run --coverage) → **21 files, 85
  tests passed**.
- The pod's root `.factory/commands.json` `test` command
  (`pnpm exec nx affected ...`) cannot run standalone inside this pod
  worktree: there is no root `package.json`/Nx workspace checked out here
  (only `apps/mfe-chat`, `services/conversation-service`, and `docs/` are
  present), so each project's own `test` script was run directly instead,
  which is the same `vitest run` Nx would invoke for `nx test`.

## Acceptance criteria coverage

| AC | Text | Test(s) | Status |
|----|------|---------|--------|
| AC-42 | Create, list, rename, open, delete chats | `chats/routes.spec.ts`, `chats/service.spec.ts`, `chat-list/api/chats.test.ts`, `chat-list/components/*.test.tsx` | PASS |
| AC-43 | Chat history persists and is restored after reload/relogin | `chat-list/api/chats.test.ts`, `messages/service.spec.ts` | PASS |
| AC-44 | Deleting a chat removes it and its messages | `chats/routes.spec.ts`, `chats/service.spec.ts`, `chat-list/components/ChatList.test.tsx` | PASS |
| AC-45 | Ownership checked server-side on every read/update/delete/stream | `shared/auth-middleware.spec.ts`, `chats/*.spec.ts`, `messages/service.spec.ts`, `streaming/routes.spec.ts` | PASS |
| AC-46 | Cross-user chat access → 403/404 | `chats/routes.spec.ts`, `chats/service.spec.ts`, `messages/service.spec.ts`, `chat-list` FE tests | PASS |
| AC-47 | List/search never returns another user's chats | `chats/repository.spec.ts`, `chats/service.spec.ts` | PASS |
| AC-48 | User chooses provider + model on create/edit | `ProviderModelSelect.test.tsx`, `chats/service.spec.ts`, `chats/routes.spec.ts` | PASS |
| AC-49 | Provider/model persisted per chat | Same as AC-48 | PASS |
| AC-50 | Subsequent messages use the persisted provider/model | `messages/processor.spec.ts` (added this session) | PASS |
| AC-51 | Sent text message persisted immediately and shown | `messages/service.spec.ts`, `composer/hooks/useComposer.test.ts` | PASS |
| AC-52 | LLM response streams token by token via SSE, renders incrementally | `messages/processor.spec.ts`, `streaming/sse.spec.ts`, `chat-view/hooks/useMessageStream.test.ts` | PASS |
| AC-53 | Full conversation history sent as context every request | `messages/processor.spec.ts`, `messages/repository.spec.ts`, `MessageList.test.tsx` | PASS |
| AC-54 | Stop mid-stream saves partial response | `messages/processor.spec.ts`, `messages/service.spec.ts`, `chat-view`/`stream-registry.test.ts` | PASS |
| AC-55 | Completed response saved and reappears after reload | `messages/processor.spec.ts`, `messages/service.spec.ts` | PASS |
| AC-56 | Messages sent while busy join FIFO queue | `messages/service.spec.ts`, `queue/chat-queue.spec.ts` | PASS |
| AC-57 | Queued messages shown in distinct "queued" state | `message-queue/components/MessageQueue.test.tsx`, `messages/service.spec.ts` | PASS |
| AC-58 | Edit/cancel a queued message before processing | `messages/service.spec.ts`, `queue/chat-queue.spec.ts` | PASS |
| AC-59 | Queued messages processed one at a time, in order | `queue/chat-queue.spec.ts`, `queue/queue-manager.spec.ts` | PASS |
| AC-60 | Multiple chats streaming simultaneously | `queue/queue-manager.spec.ts`, `stream-registry.test.ts` | PASS |
| AC-61 | Switching chats doesn't interrupt in-progress streams | `stream-registry.test.ts` | PASS |
| AC-62 | UI stays responsive with ≥5 chats streaming | `stream-registry.test.ts` | PASS |
| AC-63 | Single common adapter interface for Ollama/OpenAI/Anthropic | `llm-adapters/registry.spec.ts`, `*.provider.spec.ts` | PASS |
| AC-64 | conversation-service selects adapter by chat's configured provider | `llm-adapters/registry.spec.ts` | PASS |
| AC-65 | New provider only needs adapter-layer changes | `llm-adapters/registry.spec.ts` | PASS |
| AC-66 | Attach one or more files to a message | `attachments/*.spec.ts`, `AttachmentPicker.test.tsx` | PASS |
| AC-67 | Only .txt/.pdf/.png/.jpeg accepted; ext + MIME validated client & server | `attachments/validators.spec.ts`, `attachments/model/validators.test.ts` | PASS |
| AC-68 | Files >10MB or disallowed type rejected before upload with clear message | `attachments/validators.spec.ts`, `AttachmentPicker.test.tsx` | PASS |
| AC-69 | Text/PDF content extracted and included in LLM context | `attachments/llm-context.spec.ts`, `attachments/text-extractor.spec.ts` | PASS |
| AC-70 | Image attachments sent as vision input for supporting models | `attachments/llm-context.spec.ts`, `model-capabilities.test.ts` | PASS |
| AC-71 | Clear message when model can't handle attached file type | `model-capabilities.test.ts`, `attachments/llm-context.spec.ts` | PASS |
| AC-72 | Provider errors/timeouts/rate limits caught, surfaced, no crash | `messages/processor.spec.ts`, `MessageError.test.tsx`, `stream-registry.test.ts` | PASS |
| AC-73 | User can retry a message that failed | `messages/service.spec.ts`, `messages/processor.spec.ts` | PASS |
| AC-74 | Failed queued message skipped/marked failed without blocking queue | `queue/queue-manager.spec.ts`, `stream-registry.test.ts` | PASS |

## Notes / out-of-scope observations (not graded here, flagged for integration)

- AC-39/40 (token issuance/validation policy) belong to the `auth` pod per
  `docs/pods/chat/PLAN.md`; this pod only implements local JWT validation
  middleware consuming that contract, which is exercised by
  `shared/auth-middleware.spec.ts`.
- No application code was changed; only a missing test for AC-50 was added.
