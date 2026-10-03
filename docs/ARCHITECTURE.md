# Architecture

See `docs/STACK.md` for tech choices and decisions log. This document describes modules,
pod ownership of paths, and contracts between pods.

## 1. Pods

Work is split into pods that map to the domains in `docs/SPEC.md` §3.1, plus one
cross-cutting platform pod:

| Pod | Owns |
|-----|------|
| `platform` | Repo scaffolding, Nx/pnpm workspace config, `packages/ui`, `packages/shared-types`, `packages/eslint-config`, `packages/tsconfig`, `apps/shell`, Docker Compose, CI workflows, Prometheus/Grafana config |
| `auth` | `apps/mfe-auth`, `services/auth-service` |
| `chat` | `apps/mfe-chat`, `services/conversation-service` (including the LLM provider adapter layer and file attachment handling) |
| `settings` | `apps/mfe-settings` (no backend service; talks directly to `conversation-service` and browser storage) |

Each pod has a folder under `docs/pods/<pod>/` for pod-specific notes/specs as needed.

## 2. Path ownership (hard boundaries)

```
apps/shell/               -> platform
apps/mfe-auth/             -> auth
apps/mfe-chat/              -> chat
apps/mfe-settings/          -> settings
services/auth-service/      -> auth
services/conversation-service/ -> chat
packages/ui/                -> platform (all pods may propose components via PR)
packages/shared-types/      -> platform (all pods may propose contract changes via PR)
packages/eslint-config/     -> platform
packages/tsconfig/          -> platform
docker-compose.yml, .env.example, .github/workflows/ -> platform
docs/                        -> shared (architect + each pod owns its docs/pods/<pod>/ subfolder)
```

No pod edits another pod's owned paths directly. Cross-cutting contract changes
(`packages/shared-types`) must be proposed and are expected to be additive/backward
compatible within a release; breaking changes require coordinating with every pod that
consumes the changed contract.

## 3. Module map

```
apps/
  shell/                  # Module Federation host: layout, TanStack Router root routes,
                           # shared TanStack Query client, auth guard, error boundaries
                           # per remote (FR3, NFR reliability)
  mfe-auth/                # remote: /login, /register, logout action
  mfe-chat/                 # remote: /chats, /chats/:id (list, view, composer, queue,
                           # attachments)
  mfe-settings/             # remote: /settings (API key management, FR17-FR20)
services/
  auth-service/             # register, login, logout, refresh, JWKS/secret exposure
  conversation-service/     # chats, messages, queue, attachments, LLM adapters, SSE
packages/
  ui/                       # design system (shadcn on Base UI + Tailwind), Storybook
  shared-types/             # Zod schemas + TS types for API DTOs, auth claims,
                           # password policy, correlation header constant
  eslint-config/            # shared flat ESLint config
  tsconfig/                 # shared tsconfig bases
```

### Feature-based internal structure
Every app/service organizes code as in SPEC §3.3 (`src/features/<feature>/{components,
hooks,api,model,index.ts}` + `src/shared/`). Examples:
- `mfe-chat`: features `chat-list`, `chat-view`, `composer`, `message-queue`,
  `attachments`.
- `conversation-service`: features `chats`, `messages`, `queue`, `attachments`,
  `llm-adapters` (with `ollama`, `openai`, `anthropic` sub-modules behind one interface).
- `auth-service`: features `register`, `login`, `session` (access/refresh issuance and
  rotation), `logout`.

## 4. Auth architecture (decision #1, #2 in STACK.md)

- `auth-service` issues on login/register:
  - **Access token**: JWT (HS256, shared secret via `JWT_SECRET` env), 15 min TTL,
    claims `{ sub: userId, email, iat, exp }`. Set as `httpOnly`, `Secure`,
    `SameSite=Lax` cookie `access_token`.
  - **Refresh token**: opaque random token, 7 day TTL, stored hashed in Postgres
    (`refresh_tokens` table: id, userId, tokenHash, expiresAt, rotatedFrom, revokedAt).
    Set as `httpOnly`, `Secure`, `SameSite=Lax` cookie `refresh_token`, path scoped to
    the refresh endpoint.
  - `POST /auth/refresh` validates the refresh cookie, rotates it (issues a new refresh
    token, marks the old one used/invalid), and issues a new access token.
  - `POST /auth/logout` revokes the current refresh token and clears both cookies.
- `conversation-service` validates the access token **locally** on every request using
  the same `JWT_SECRET` (both services read it from env; no network call per request).
  Invalid/expired/missing token -> `401`. Valid token but chat not owned by `sub` ->
  `403`/`404` (FR5, UC7).
- The shell's auth guard checks for a valid session (via a lightweight `GET
  /auth/me` on `auth-service`, or a client-side check + 401 redirect) before rendering
  `mfe-chat`/`mfe-settings` routes, and triggers a silent refresh via
  `POST /auth/refresh` when the access token is near/at expiry.
- Password hashing: bcrypt (`auth-service` only). Password policy (decision #4): min 8
  chars, ≥1 letter, ≥1 number — defined once as a Zod schema in
  `packages/shared-types`, imported by both `mfe-auth`'s form validation and
  `auth-service`'s registration handler.

## 5. Chat, streaming and queue architecture

- `conversation-service` owns Postgres tables: `chats`, `messages`, `attachments`
  (Prisma schema). Every query is scoped by `ownerId = req.userId` from the validated
  JWT (FR5).
- Message send flow: `POST /chats/:id/messages` enqueues the message in an in-memory
  per-chat FIFO queue (keyed by chatId, process-local; acceptable at this scope since a
  single `conversation-service` instance is run). The queue processor takes one message
  at a time, calls the selected provider adapter, and streams the response back over
  **Server-Sent Events** (`GET /chats/:id/stream`) to any connected client for that
  chat. Multiple chats stream independently and concurrently (FR7, UC6), each with its
  own queue/state so switching chats in the UI never interrupts other streams.
  Queued-but-not-started messages can be edited/canceled (FR11) by mutating the
  in-memory queue entry before the processor picks it up.
- LLM Provider Adapter layer: one `LlmProvider` interface
  (`sendMessage(context, options) -> AsyncIterable<token>`) with `OllamaProvider`,
  `OpenAiProvider`, `AnthropicProvider` implementations selected by the chat's configured
  provider/model (FR6). Adding a provider means adding one adapter + a registry entry;
  no changes outside `features/llm-adapters`.
- Per-request LLM API keys (FR19): sent by the browser in a request header (e.g.
  `X-Llm-Api-Key`) on send-message/test-connection calls, read once by the adapter,
  never logged (redacted in `pino` log serializers) or persisted.
- Attachments (decision #3): `multipart/form-data` upload validated for extension **and**
  MIME type and size (FR14-FR15) client-side (`mfe-chat`) and server-side
  (`conversation-service`), stored on disk under `UPLOAD_DIR` (default
  `./data/uploads`, a Docker volume), with metadata rows in Postgres referencing the
  path. Text/PDF content is extracted to text for the LLM context; images are passed as
  vision input only if the selected model supports it, otherwise the API responds with a
  clear error (FR16).

## 6. Configuration (API keys) architecture

- `mfe-settings` stores provider API keys client-side only (`localStorage`, namespaced
  by logged-in userId) — never sent to `auth-service`, never persisted server-side
  (FR18).
- "Test connection" and every chat message call go through `conversation-service`,
  which forwards the key to the provider for that single request only (FR19-FR20).

## 7. Cross-cutting concerns

- **Correlation ID** (decision #8): constant `CORRELATION_HEADER = "X-Correlation-Id"`
  exported from `packages/shared-types`. The shell's HTTP client generates a UUID if the
  header is absent on outgoing requests. Both services read the incoming header (or
  generate one if missing, e.g. for direct API calls/tests), attach it to the `pino`
  logger context for the request lifetime, and echo it back on the response.
- **Observability**: each service exposes `/metrics` (Prometheus format via
  `prom-client`) and structured JSON logs (`pino`) including correlation ID, route,
  status, latency. Grafana dashboards provisioned under `platform`'s compose config read
  from Prometheus.
- **CSP / security**: shell sets a strict Content-Security-Policy; both services use
  `helmet`; all input validated with `zod` schemas from `packages/shared-types`.
- **Contract testing**: Pact consumer tests in each `mfe-*`/`shell` against
  `auth-service` and `conversation-service`; provider verification runs in each
  service's CI job.

## 8. CI (decision #5, #6)

GitHub Actions workflow (`.github/workflows/ci.yml`, owned by `platform`):
1. Install (`pnpm install --frozen-lockfile`).
2. `nx affected -t lint typecheck test build` against the PR's base branch.
3. Vitest coverage thresholds (80% lines) enforced as part of each project's `test`
   target for `services/*` and `packages/ui`; failing threshold fails the job.
4. Playwright E2E job (separate, runs `docker compose up` including the pre-pulled
   `llama3.2:1b` Ollama model) covering UC1-UC8, run on a schedule/PR label to keep PR
   feedback fast (exact trigger left to the `platform` pod's CI implementation).
