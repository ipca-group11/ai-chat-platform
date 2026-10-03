# QA: `configuration` pod

Verdict: PASS

## Scope

This pod (`apps/mfe-settings` + the additive `packages/shared-types/src/api-keys/*`
contract) has **no backend service**; per `docs/ARCHITECTURE.md` and
`docs/pods/configuration/PLAN.md` §3, several acceptance criteria under US-25/US-26 are
end-to-end criteria whose implementation is split across pods (`chat`'s
`conversation-service` / `mfe-chat`, `platform`'s shell nav). This QA pass verifies
everything owned by this pod and calls out the cross-pod items explicitly rather than
faking coverage for code that doesn't exist in this pod's tree.

## What was done

- Added `apps/mfe-settings/src/app.test.tsx` with two `AC-75`-named tests (the only AC
  that previously had no test whose name included its id): one renders the `/settings`
  page content directly, one asserts the Module Federation `./routes` entry point
  (`src/routes.tsx`) default-exports the same page component the shell mounts.
- Ran the full test/typecheck suite for both projects in this pod
  (`apps/mfe-settings`, `packages/shared-types`) via each project's own `test`/
  `typecheck` npm scripts (the repo-root `pnpm-workspace.yaml`/`package.json`/
  `nx.json` that `.factory/commands.json`'s `pnpm exec nx affected ...` command
  requires are not present in this pod's worktree, so `nx affected` itself could not be
  invoked here; see "Test execution notes" below).
- No application code was modified.

## Test execution notes

- `packages/shared-types`: `pnpm install --frozen-lockfile` (its own lockfile) then
  `pnpm test` (vitest) and `pnpm run typecheck` — both clean.
- `apps/mfe-settings`: has no lockfile of its own and depends on `workspace:*`
  siblings (`@app/shared-types`, `@app/ui`) that only resolve inside a pnpm workspace.
  To install and run its tests, a temporary workspace root (`pnpm-workspace.yaml`,
  minimal `package.json`, and a no-op `@app/ui` stub package, since `packages/ui` is
  owned by the `design-system` pod and isn't in this worktree) was created, `pnpm
  install` was run, then `pnpm test`/`pnpm run typecheck` were run, and finally all of
  that scaffolding (`node_modules`, `pnpm-workspace.yaml`, root `package.json`, the
  `@app/ui` stub, generated `pnpm-lock.yaml`, `coverage/`) was deleted again so no
  QA-only artifacts are left in the pod's tree.
  - `pnpm test` first failed all 52 tests with `TypeError: React.act is not a
    function` — this is an environment artifact of this sandbox (`NODE_ENV=production`
    is set in the shell, which makes React/ReactDOM resolve their production builds
    that strip `act`), not an application defect. Re-running with `NODE_ENV=test`
    (vitest's normal default when the shell doesn't already export `NODE_ENV`) passed
    all 52 tests (including the 2 new `AC-75` tests) with 100% line/statement/function
    coverage and 95.8% branch coverage, comfortably above the repo's 80% threshold.
  - `pnpm run typecheck` (`tsc --noEmit`) passed cleanly.
  - `pnpm run lint` could not run (`eslint: not found`): `eslint` and the shared flat
    config live in `packages/eslint-config` (owned by `platform-foundation`, AC-9),
    which is not present in this pod's worktree. This is an infrastructure/ownership
    gap, not a `configuration`-pod code issue.

## Acceptance criteria

| AC | Text (abridged) | Test(s) | Status |
|----|------|---------|--------|
| AC-75 | Configuration page reachable from app navigation | `app.test.tsx`: "AC-75: renders the configuration page content so /settings is routable", "AC-75: the `./routes` module federation entry point default-exports the same page component" | PASS (page/route exist and are tested here; the nav *link* itself is added by the `shell`, owned by `platform`, per PLAN.md §3) |
| AC-76 | Enter/update/remove key per provider (OpenAI, Anthropic) | `schema.test.ts`, `storage.test.ts`, `useApiKeys.test.tsx`, `ProviderList.test.tsx`, `ApiKeyForm.test.tsx`, `MaskedKeyDisplay.test.tsx` — multiple `AC-76:`-named tests | PASS |
| AC-77 | Ollama shown as not requiring a key | `schema.test.ts`, `providerMeta.test.ts`, `useApiKeys.test.tsx`, `ProviderList.test.tsx` — multiple `AC-77:`-named tests | PASS |
| AC-78 | Keys stored only in browser, scoped to logged-in user | `storage.test.ts`, `useCurrentUserId.test.tsx`, `auth.test.ts` — `AC-78:`-named tests | PASS |
| AC-79 | Keys never sent to/stored in DB, disk, or server logs | `storage.test.ts`: "AC-79: never persists the raw key value..."; `useApiKeys.test.tsx`: "AC-79: never writes the raw key value into localStorage"; `schema.test.ts`: "AC-79: ..." | PASS (by construction: no network write path exists in this feature) |
| AC-80 | Different user never sees previous user's keys | `storage.test.ts`, `ProviderList.test.tsx` — `AC-80:`-named tests | PASS |
| AC-81 | Browser sends the provider's key with each LLM-calling request (header) | `schema.test.ts`: "AC-81: exposes a stable header name constant" | PARTIAL — the shared `X-Llm-Api-Key` header-name contract is defined and tested here; actually *attaching* the header when sending a chat message is implemented in `mfe-chat`'s composer, owned by the `chat` pod (tracked cross-pod dependency, PLAN.md §3) |
| AC-82 | `conversation-service` uses the key once, never persists it | — none in this pod | N/A for this pod — `conversation-service` is owned by the `chat` pod and has no code in this pod's tree to test |
| AC-83 | Key redacted from `conversation-service` logs/errors | — none in this pod | N/A for this pod — same as AC-82, owned by `chat` pod |
| AC-84 | Saved keys displayed masked, never in full | `storage.test.ts`, `MaskedKeyDisplay.test.tsx` — `AC-84:`-named tests | PASS |
| AC-85 | "Test connection" validates key, shows success/clear failure | `test-connection.test.ts`, `testConnection.test.ts`, `TestConnectionButton.test.tsx` — multiple `AC-85:`-named tests | PASS |
| AC-86 | Missing-key message in chat with link to `/settings` | `test-connection.test.ts`: "AC-86: exposes a stable route mfe-chat can link back to" | PARTIAL — the shared route constant/messaging source this pod owns is tested here; the actual message/link rendering happens in `mfe-chat`, owned by the `chat` pod (cross-pod dependency, PLAN.md §3) |
| AC-87 | Removing a key prompts for it again on next message | `storage.test.ts`, `useApiKeys.test.tsx`, `ApiKeyForm.test.tsx`, `ProviderList.test.tsx` — multiple `AC-87:`-named tests | PASS on the storage side owned by this pod (removal deletes the localStorage entry immediately); the "prompt on next message" read-side behavior is `mfe-chat`'s, owned by the `chat` pod |

## Summary

Every acceptance criterion owned or partially owned by this pod has at least one test
named with its AC id, and the full local test suite for both projects in this pod
passes (52/52 in `apps/mfe-settings`, 34/34 in `packages/shared-types`), with
`typecheck` clean for both. AC-82 and AC-83 have no tests in this pod because their
entire implementation surface (`conversation-service`) lives outside this pod's
ownership and worktree, as documented in `docs/pods/configuration/PLAN.md` §3; they
should be verified by the `chat` pod's own QA pass. `lint` could not be executed due to
the shared `packages/eslint-config` (owned by `platform-foundation`) not being present
in this worktree.
