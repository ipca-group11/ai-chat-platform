# Pod Plan: chat

Source stories: `docs/BACKLOG.json` pod id `chat` (US-13 .. US-22, AC-42 .. AC-74).
See `docs/STACK.md` (stack + decisions log) and `docs/ARCHITECTURE.md` §5 (chat,
streaming and queue architecture) for the binding technical decisions this plan follows.

## 1. Scope & ownership

This pod owns, end to end:
- `apps/mfe-chat` — chat list, chat view, composer, message queue, attachments UI
  (Vite Module Federation remote, feature-based structure per SPEC §3.3).
- `services/conversation-service` — chats, messages, queue, SSE streaming, LLM
  provider adapters, attachment storage/extraction (Prisma + Postgres).

Out of scope (owned by other pods, consumed here as contracts):
- `apps/shell` provides the Module Federation host, shared TanStack Query client,
  routing shell, and auth guard (platform pod). This pod only registers routes/remote
  entry and consumes the shared query client.
- `services/auth-service` issues/validates JWTs (auth pod). `conversation-service`
  validates the access-token cookie **locally** with the shared `JWT_SECRET` (decision
  #1 in STACK.md) — this pod implements that local validation middleware since it lives
  inside `conversation-service`, but the AC for token issuance/validation policy
  (AC-39/40) belongs to the `auth` pod's plan. Flag any mismatch found during
  integration.
- `apps/mfe-settings` manages/stores provider API keys client-side (settings pod) and
  sends them as a request header (`X-Llm-Api-Key`) on calls that reach this pod's
  service; this pod only reads/forwards/redacts that header, never persists it
  (AC-82, AC-83 — settings pod's ACs, but implemented inside `conversation-service`).
- `packages/ui`, `packages/shared-types`, `packages/eslint-config`, `packages/tsconfig`
  are owned by `platform`. This pod proposes additive changes to
  `packages/shared-types` (DTOs, Zod schemas, SSE event types, provider enum) via PR
  rather than editing app/service-local copies.

## 2. Shared contracts this pod proposes (packages/shared-types)

Before/alongside BE-2..BE-6, propose additive types consumed by both `mfe-chat` and
`conversation-service`:
- `Chat` DTO (`id, title, ownerId, provider, model, createdAt, updatedAt`).
- `Message` DTO (`id, chatId, role, content, attachments[], status: sent|queued|
  streaming|failed, createdAt`).
- `Provider` enum (`ollama | openai | anthropic`) + per-provider model id type.
- `Attachment` DTO (`id, messageId, filename, mimeType, size, kind: text|pdf|image`).
- SSE event payload types for the message stream (`token`, `done`, `error`).
- `X-Llm-Api-Key` / correlation header constants already defined by platform —
  reused, not redefined.

## 3. Backend tasks (`services/conversation-service`)

| Task | Stories | Files owned | Acceptance criteria covered |
|------|---------|-------------|------------------------------|
| **BE-1: Service scaffold, data model, auth/ownership middleware** | foundation for US-13..22 | `services/conversation-service/{server.ts,app.ts,project.json,package.json,tsconfig.json,Dockerfile}`, `prisma/schema.prisma` (+migrations) for `chats`, `messages`, `attachments`, `src/shared/{env.ts,prisma.ts,logger.ts,correlation-middleware.ts,auth-middleware.ts,metrics.ts,error-handler.ts}` | No AC directly graded, but is a hard prerequisite for AC-45/46/47 (ownership scoping needs the validated `req.userId`) and for cross-cutting logging/metrics conventions (structured pino logs, correlation id, `/metrics`) described in ARCHITECTURE.md §7. Also implements the local JWT validation referenced by auth pod's AC-39. |
| **BE-2: Chats CRUD + ownership isolation** (US-13, US-14) | `src/features/chats/{routes.ts,controller.ts,service.ts,schema.ts,index.ts}` + tests | AC-42, AC-43 (chat + history rows persisted, restored on reload/relogin), AC-44 (cascade delete of messages/attachments on chat delete), AC-45, AC-46, AC-47 |
| **BE-3: Provider & model selection per chat** (US-15) | extends `src/features/chats/{schema.ts,service.ts}`; proposes `Provider` enum in `packages/shared-types` | AC-48, AC-49, AC-50 |
| **BE-4: Messages, SSE streaming, FIFO queue, concurrent chats** (US-16, US-17, US-18) | `src/features/messages/{routes.ts,controller.ts,service.ts,schema.ts,index.ts}`, `src/features/streaming/{sse.ts,routes.ts,index.ts}`, `src/features/queue/{chat-queue.ts,queue-manager.ts,index.ts}` + tests | AC-51, AC-52, AC-53, AC-54, AC-55, AC-56, AC-57 (server-side queue state the UI reflects), AC-58, AC-59, AC-60, AC-61, AC-62 |
| **BE-5: LLM provider adapter layer + error handling/retry** (US-19, US-22) | `src/features/llm-adapters/{types.ts,registry.ts,ollama.provider.ts,openai.provider.ts,anthropic.provider.ts,index.ts}` + unit tests with LLMs mocked | AC-63, AC-64, AC-65, AC-72, AC-73, AC-74 |
| **BE-6: Attachments upload, validation, extraction** (US-20, US-21) | `src/features/attachments/{routes.ts,controller.ts,service.ts,validators.ts,storage.ts,text-extractor.ts,index.ts}`, `UPLOAD_DIR` volume wiring (env only; compose entry owned by platform) + tests | AC-66, AC-67, AC-68, AC-69, AC-70, AC-71 |

Order: BE-1 → BE-2 → BE-3 (small extension) → BE-4 & BE-5 in parallel (queue needs the
adapter interface, so land BE-5's `LlmProvider` interface first, implementations can
follow) → BE-6 (independent, can start after BE-2's message model exists).

## 4. Frontend tasks (`apps/mfe-chat`)

| Task | Stories | Files owned | Acceptance criteria covered |
|------|---------|-------------|------------------------------|
| **FE-1: Remote scaffold & routing** | foundation for US-13..22 | `apps/mfe-chat/{vite.config.ts,project.json,package.json,tsconfig.json}`, `src/app/{routes.tsx,remote-entry.ts}`, `src/shared/{api-client.ts,query-keys.ts}` | No AC directly graded; registers `/chats` and `/chats/:id` routes consumed by the shell (platform pod's AC-22/23), wires the shell's shared TanStack Query client (AC-25) and design-system components only (AC-18, design-system pod) |
| **FE-2: Chat list & chat CRUD UI** (US-13, US-14) | `src/features/chat-list/{components,hooks,api,model,index.ts}` | AC-42, AC-43 (list/open restores history via query), AC-44, AC-46 (403/404 surfaced as a clear not-found/error state, never another user's data rendered), AC-47 |
| **FE-3: Provider & model picker** (US-15) | `src/features/chat-list/components/ProviderModelSelect.tsx` (create/edit chat dialog), `src/features/chat-list/api/*` | AC-48, AC-49, AC-50 |
| **FE-4: Composer, streaming view, queue, parallel sessions** (US-16, US-17, US-18) | `src/features/chat-view/{components,hooks,api,model,index.ts}`, `src/features/composer/{components,hooks,index.ts}`, `src/features/message-queue/{components,hooks,model,index.ts}` | AC-51, AC-52, AC-54, AC-55, AC-57, AC-58, AC-60, AC-61, AC-62 |
| **FE-5: Attachments UI** (US-20, US-21) | `src/features/attachments/{components,hooks,api,model,index.ts}` | AC-66, AC-67, AC-68, AC-71 |
| **FE-6: Provider error & retry UI** (US-22) | `src/features/chat-view/components/MessageError.tsx`, retry action in `chat-view`/`message-queue` | AC-72, AC-73, AC-74 |

Order: FE-1 → FE-2 → FE-3 → FE-4 (depends on BE-4/BE-5 contracts, can be built against
mocked SSE responses first) → FE-5 (depends on BE-6 contract) → FE-6.

## 5. Testing (owned by this pod, in addition to quality-observability pod's suite)

- Vitest unit tests per feature (`src/features/**/*.test.ts(x)`) for both apps and the
  service, including each `llm-adapters` implementation with the LLM client mocked
  (feeds quality-observability's AC-94 but authored here since the code lives here).
- Contract (Pact) tests: `mfe-chat` as consumer of `conversation-service`'s chats/
  messages/attachments/stream endpoints; provider verification added to
  `conversation-service`'s test target.
- No Playwright/K6 authored here (quality-observability pod), but this pod keeps
  `data-testid`s and stable routes needed for UC3-UC7 e2e coverage.

## 6. Definition of done per task
- `nx lint`, `nx typecheck`, `nx test`, `nx build` pass for the owned project.
- Only imports from `shared/`, other features' `index.ts`, and `packages/*` (no
  cross-feature internals, no ad-hoc UI primitives outside `packages/ui`).
- Every endpoint added to `conversation-service` enforces the auth/ownership
  middleware from BE-1 and redacts API keys/tokens from logs and error responses.
- New/changed DTOs land as an additive PR to `packages/shared-types` before the
  frontend task that consumes them is merged.

## 7. Risks / open items for integration
- Queue is in-memory/process-local per ARCHITECTURE.md §5 (accepted for this scope);
  flag if platform's compose ever runs multiple `conversation-service` replicas.
- Vision-input support (AC-70) depends on which Ollama/OpenAI/Anthropic models are
  configured; BE-5/BE-6 must reject gracefully (AC-71) rather than assume support.
- Confirm with `settings` pod the exact header name/format for forwarded API keys and
  with `auth` pod the exact cookie/claim shape consumed by BE-1's auth middleware.
