# Plan: `configuration` pod

Domain: Configuration microfrontend for browser-only LLM API key management.
Backlog stories: US-23, US-24, US-25, US-26 (`docs/BACKLOG.json`, pod id `configuration`).

This pod has **no backend service** (per `docs/ARCHITECTURE.md` §1/§6: "keys stay in the
browser"). All work happens in `apps/mfe-settings`, plus a small, additive proposal to
`packages/shared-types` for the client/server contract that other pods consume.

## 1. Ownership

Owned paths (this pod edits these directly):
- `apps/mfe-settings/**`

Proposed/additive-only paths (shared, owned by `platform`; this pod may PR into them per
`docs/ARCHITECTURE.md` §2, but must not make breaking changes):
- `packages/shared-types/src/api-keys/**` (new file(s)): storage namespace scheme, Zod
  schemas for the stored key record and the test-connection request/response, the
  `X-Llm-Api-Key` header name constant, and a small framework-agnostic
  `readStoredApiKey(userId, provider)` / `writeStoredApiKey(...)` helper.

Not owned by this pod, but required at runtime (HTTP contracts only, no file/code
imports across app boundaries):
- `auth-service` `GET /auth/me` (owned by `auth` pod) — used to resolve the current
  user id for localStorage namespacing (AC-78, AC-80).
- `conversation-service` (owned by `chat` pod) — must accept `X-Llm-Api-Key` on
  LLM-calling requests, use it once, never persist it, and redact it from logs/errors
  (AC-82, AC-83), and should expose a lightweight test-connection endpoint per provider
  (AC-85). `mfe-chat`'s composer (owned by `chat` pod) must read the stored key via the
  shared helper above and attach the header when sending a message, and must show the
  "no key configured" message with a link to `/settings` (AC-81, AC-86). These are
  flagged as cross-pod dependencies below and are **not** delivered by this pod's tasks;
  they must land in the `chat` pod's plan for US-25/AC-86 to be fully satisfied
  end-to-end.
- App navigation entry linking to `/settings` is wired by the `shell` (owned by
  `platform`); this pod exposes the route/remote entry point the shell links to
  (AC-75).

## 2. Frontend tasks

All tasks live under `apps/mfe-settings/src/features/api-keys/` following the
feature-based layout in `docs/ARCHITECTURE.md` §3 (`components/`, `hooks/`, `api/`,
`model/`, `index.ts`), plus app shell files. Tasks are ordered but can be parallelized
after FE-1 lands.

### FE-1: `mfe-settings` app scaffold, Module Federation remote, and `/settings` route
- **Files**: `apps/mfe-settings/{project.json,vite.config.ts,tsconfig*.json,package.json}`,
  `apps/mfe-settings/src/{main.tsx,app.tsx}`, `apps/mfe-settings/src/routes/settings.tsx`,
  `apps/mfe-settings/src/shared/**`
- **Work**: Scaffold the Vite app with Nx targets (`lint`, `typecheck`, `test`, `build`,
  `serve`) per `docs/BACKLOG.json` US-1/AC-3 conventions already set by `platform`;
  expose the app as a Module Federation remote (`@module-federation/vite`) consumed by
  `apps/shell`; define the `/settings` TanStack Router route rendering the API-keys
  feature; use only `packages/ui` components for layout/primitives (no ad-hoc markup).
- **Covers**: AC-75 (page exists and is routable; reachability from nav depends on the
  `shell` adding the link, tracked as a cross-pod dependency above).

### FE-2: API key storage contract + CRUD (add/update/remove) per provider
- **Files**: `packages/shared-types/src/api-keys/{schema.ts,storage.ts,index.ts}`
  (proposed additive contract), `apps/mfe-settings/src/features/api-keys/{model,api,hooks}/**`,
  `apps/mfe-settings/src/features/api-keys/components/{ProviderList,ApiKeyForm}.tsx`,
  `apps/mfe-settings/src/features/api-keys/index.ts`
- **Work**:
  - Define the storage contract in `shared-types`: key format
    `llm-api-key:{userId}:{provider}`, a Zod schema for the stored record (provider,
    last-4 chars for masking, createdAt — never the raw key beyond what's needed to use
    it), and read/write/remove helpers backed by `window.localStorage`.
  - Resolve the current user id via a TanStack Query hook calling `GET /auth/me` on
    `auth-service` (shared Query client from the shell, per `docs/ARCHITECTURE.md` §4),
    so keys are namespaced per logged-in user and switching users never exposes a
    previous user's keys.
  - Build the provider list UI (OpenAI, Anthropic, Ollama) using `packages/ui` Card/Form
    field/Button components: OpenAI and Anthropic show an editable key field + Save;
    Ollama renders a static "no API key required" state with no input.
  - Implement add/update/remove actions writing through the shared storage helper only
    (no network calls, no persistence outside the browser).
- **Covers**: US-23 (AC-76, AC-77), US-24 (AC-78, AC-79 — by construction, since no
  network write path to any backend exists in this feature, AC-80).

### FE-3: Masked display, "Test connection", and missing-key messaging
- **Files**: `apps/mfe-settings/src/features/api-keys/components/{MaskedKeyDisplay,TestConnectionButton}.tsx`,
  `apps/mfe-settings/src/features/api-keys/api/testConnection.ts`,
  `packages/shared-types/src/api-keys/test-connection.ts` (proposed: request/response DTO
  + route path constant consumed by `conversation-service`)
- **Work**:
  - Render saved keys masked (e.g. `sk-...a1b2`, last 4 chars only) everywhere a key is
    shown; never render the full value after initial entry.
  - "Test connection" button calls the shared test-connection contract against
    `conversation-service` (chat pod implements the endpoint), sending the key once in
    the `X-Llm-Api-Key` header, and shows a success/failure toast (`packages/ui` Toast)
    with a clear failure reason from the response.
  - Define (in `shared-types`) the constant/route used by `mfe-chat` to link back to
    `/settings` from its "no key configured" message, so both mfes agree on the path.
- **Covers**: US-26 (AC-84, AC-85; AC-86 is cross-pod — this task only provides the
  shared route constant and messaging copy source, the actual chat-side message and
  link render in `mfe-chat`, owned by `chat`; AC-87 — removing a key deletes the
  localStorage entry immediately, so the next `mfe-chat` read via the shared helper
  naturally returns "no key," satisfying AC-87 once `chat` pod's read-side lands).

### FE-4: Component tests and Storybook-less unit coverage
- **Files**: `apps/mfe-settings/src/features/api-keys/**/*.test.ts(x)`,
  `packages/shared-types/src/api-keys/**/*.test.ts`
- **Work**: Vitest + Testing Library unit tests for the storage helpers (namespacing,
  masking, removal), the CRUD UI (add/update/remove per provider, Ollama no-key state),
  and the test-connection flow (mocked fetch: success, invalid key, network error). Cover
  the "different user, no leaked keys" scenario (AC-80) explicitly. Target the repo's
  80% line coverage threshold (`docs/STACK.md` decision #6) for this feature's
  business-logic code.
- **Covers**: verification for AC-75–AC-80, AC-84, AC-85, AC-87 (chat-integration halves
  of AC-81/82/83/86 are verified by the `chat` pod's own tests and, later, by the
  Playwright UC8 e2e test owned by `quality-observability`).

## 3. Cross-pod dependencies (tracked, not owned by this pod)

| Need | Owned by | AC(s) |
|------|----------|-------|
| `GET /auth/me` returns current user id | `auth` | AC-78, AC-80 |
| `X-Llm-Api-Key` header accepted, used once, never persisted, redacted from logs/errors | `chat` (`conversation-service`) | AC-82, AC-83 |
| Test-connection endpoint per provider on `conversation-service` | `chat` | AC-85 |
| `mfe-chat` composer reads the shared storage helper and attaches the header on send | `chat` (`apps/mfe-chat`) | AC-81 |
| `mfe-chat` shows "no key configured" message with link to `/settings` when a provider has no stored key | `chat` (`apps/mfe-chat`) | AC-86 |
| Shell adds a navigation entry linking to `/settings` | `platform` (`apps/shell`) | AC-75 |
| Strict CSP allowing `localStorage` use but mitigating XSS exposure of keys (NFR Security) | `platform` (`apps/shell`) | NFR |

This pod delivers the shared `packages/shared-types/src/api-keys/*` contract (storage
scheme, DTOs, header/route constants) as the integration point; the table above should
be reflected in the `chat` and `platform` pods' plans so the end-to-end acceptance
criteria (AC-81, AC-82, AC-83, AC-86) are fully closed once all pods land their pieces.

## 4. Acceptance criteria coverage summary

| AC | Task | Fully closed by this pod? |
|----|------|---------------------------|
| AC-75 | FE-1 | Partial (nav link is `platform`'s) |
| AC-76, AC-77 | FE-2 | Yes |
| AC-78, AC-79, AC-80 | FE-2 | Yes |
| AC-81 | FE-3 (contract only) | No — `chat` pod |
| AC-82, AC-83 | — | No — `chat` pod |
| AC-84, AC-85 | FE-3 | Yes (AC-85 needs `chat`'s endpoint to exist) |
| AC-86 | FE-3 (contract only) | No — `chat` pod |
| AC-87 | FE-2/FE-3 | Yes on the storage side; needs `chat`'s read-side |
