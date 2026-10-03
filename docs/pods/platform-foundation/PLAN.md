# Plan: platform-foundation

Source stories: `docs/BACKLOG.json` → pod `platform-foundation` (US-1..US-4).
Context: `docs/STACK.md` §1-2 (mandatory stack, decisions), `docs/ARCHITECTURE.md` §1-3, §8.

This pod is pure tooling/infrastructure — it has no UI or API surface of its own, so
tasks are not split into "backend"/"frontend" but into four sequential infra tasks. This
pod's output (workspace config, `packages/eslint-config`, `packages/tsconfig`,
`packages/shared-types`) is a **hard dependency** for every other pod's build, so tasks
T1 and T2 should land first; other pods add their own `apps/*`/`services/*` project.json
files on top of the conventions defined here.

## Ownership (paths this pod writes/owns)

```
package.json, pnpm-workspace.yaml, pnpm-lock.yaml, nx.json, tsconfig.base.json,
.nvmrc, .gitignore, .npmrc
packages/shared-types/**
packages/eslint-config/**
packages/tsconfig/**
docker-compose.yml, .env.example
.github/workflows/ci.yml
docs/pods/platform-foundation/**
```

Not owned by this pod (other pods own their Dockerfiles and project.json under their own
app/service directory; `docker-compose.yml` here only references
`apps/*/Dockerfile` / `services/*/Dockerfile` by path):
`apps/shell`, `apps/mfe-auth`, `apps/mfe-chat`, `apps/mfe-settings`, `services/auth-service`,
`services/conversation-service`, `packages/ui` (owned by the `design-system` pod).

---

## T1 — Monorepo scaffolding: Nx + pnpm workspaces

Covers US-1: AC-1, AC-2, AC-3, AC-4.

Files:
- `pnpm-workspace.yaml` — declares `apps/*`, `services/*`, `packages/*` as workspace packages (AC-1).
- `package.json` (root) — pnpm scripts (`nx`, `lint`, `typecheck`, `test`, `build` wrappers around `nx affected`/`nx run-many`), devDependency on `nx`, `typescript`.
- `nx.json`:
  - `namedInputs`/`targetDefaults` for `lint`, `typecheck`, `test`, `build`, `serve`, `storybook` so every project inherits sane caching/dependsOn (`build` depends on `^build`, etc.) (AC-3).
  - `nx affected` base branch config consumed by `.factory/commands.json`'s `test` command.
  - Nx module-boundary tag scheme, enforced via `@nx/enforce-module-boundaries` lint rule (shipped from `packages/eslint-config`, wired into every project's lint target):
    - `type:app` (`apps/shell`, `apps/mfe-auth`, `apps/mfe-chat`, `apps/mfe-settings`)
    - `type:service` (`services/auth-service`, `services/conversation-service`)
    - `type:package` (`packages/ui`, `packages/shared-types`, `packages/eslint-config`, `packages/tsconfig`)
    - `scope:shell` / `scope:auth` / `scope:chat` / `scope:settings` / `scope:shared`
  - Boundary rule: `type:app` may depend on `type:package` only, never on another
    `type:app` or on `type:service` (AC-4). `type:service` may depend on `type:package`
    only. `type:package` may depend only on other `type:package`.
  - `tsconfig.base.json` at repo root with `paths` mapping `@shared-types/*`, `@ui/*` etc.
    to `packages/*/src`, extended by `packages/tsconfig`.
- `.nvmrc` (Node 26.x), root `.gitignore`, `.npmrc` (pnpm settings, e.g. hoist pattern for Nx).
- A short `docs/pods/platform-foundation/CONVENTIONS.md`: documents the exact `project.json`
  target shape (name, executor, tags) every other pod must copy when adding
  `apps/*`/`services/*` projects, so AC-2/AC-3 hold once every pod's project lands.
  This unblocks `auth`, `chat`, `shell`, `settings`, `design-system` pods to self-serve
  without waiting on this pod again.

Note: since `apps/*`/`services/*`/`packages/ui` are created by other pods in their own
worktrees, this pod cannot itself add their `project.json` files. AC-2 ("project graph
covering every app, service, and package") and AC-3 are only fully satisfiable once all
pods are merged; this pod's job is to ship the `nx.json` targetDefaults + tag scheme +
`CONVENTIONS.md` so every pod's own `project.json` is consistent, and to **verify/fix the
full project graph during integration** (Tech Lead step, not part of this build task).

Validation: `pnpm install`, `pnpm exec nx graph --file=/tmp/graph.json` runs without
error once at least one project exists; `pnpm exec nx run-many -t lint typecheck test build`
succeeds for the projects this pod owns.

---

## T2 — Shared libraries: shared-types, eslint-config, tsconfig

Covers US-3: AC-8, AC-9, AC-10, AC-11.

Files:
- `packages/shared-types/`:
  - `src/auth/` — Zod schemas + TS types for register/login DTOs, JWT claims shape, the
    password-policy schema (min 8 chars, ≥1 letter, ≥1 number per `STACK.md` decision #4).
  - `src/chat/` — DTOs for chat, message, attachment, provider/model selection, SSE
    event shapes.
  - `src/http/` — `CORRELATION_HEADER = "X-Correlation-Id"` constant + a small helper to
    read/generate it (decision #8), shared error-response shape.
  - `src/index.ts` — public API (feature-folder convention: nothing outside `index.ts` is
    imported by consumers) (AC-8, AC-11).
  - `project.json` with `lint`, `typecheck`, `test`, `build` targets, tags
    `type:package`, `scope:shared`.
- `packages/eslint-config/`:
  - Flat config (`eslint.config.js`/`.mjs`) using `typescript-eslint`, React hooks rules
    for frontend projects, `@nx/enforce-module-boundaries`, and a `boundaries`/custom
    rule enforcing "feature folders only import `shared/` or other features'
    `index.ts`" (AC-9, AC-11, SPEC §3.3).
  - Exposes composable presets (`base`, `react`, `node`) so each app/service extends the
    one it needs.
- `packages/tsconfig/`:
  - `base.json` (strict mode, `noEmit`, module resolution for Node 26/TS 7), `react.json`
    (extends base + JSX/DOM libs), `node.json` (extends base + Node types).
  - Every consumer's own `tsconfig.json` extends one of these; `tsc --noEmit` must pass
    per project (AC-10) — verified per-project by that project's own `typecheck` target,
    and in aggregate by CI (`nx affected -t typecheck`).

Validation: `pnpm exec nx run shared-types:build && pnpm exec nx run shared-types:test`;
`pnpm exec nx run shared-types:lint` exercises the eslint-config against real source;
a throwaway `tsconfig.json` extending each `packages/tsconfig/*.json` typechecks cleanly.

---

## T3 — Docker Compose local development environment

Covers US-2: AC-5, AC-6, AC-7.

Files:
- `docker-compose.yml` — services: `shell`, `mfe-auth`, `mfe-chat`, `mfe-settings`,
  `auth-service`, `conversation-service`, `postgres`, `ollama` (+ one-shot `ollama-pull`
  init job for `llama3.2:1b` per `STACK.md` decision #7), `prometheus`, `grafana`
  (AC-5, AC-6). References each app/service's own `Dockerfile` (owned by the respective
  pod) by build context path; this pod does not author those Dockerfiles, only wires
  them up, ports, networks, volumes (`./data/uploads`, Postgres volume), and healthchecks.
- `observability/prometheus.yml` — scrape configs for `auth-service`/`conversation-service`
  `/metrics` (feeds `quality-observability` pod's US-28; owned here since it's part of
  compose wiring).
- `observability/grafana/provisioning/**` — datasource pointing at `prometheus`,
  dashboard provisioning folder (empty/placeholder dashboard JSON if `quality-observability`
  pod's dashboard isn't ready yet; that pod may add/replace the dashboard JSON file itself
  under this same provisioning path).
- `.env.example` — every env var referenced across services (Postgres URL, `JWT_SECRET`,
  access/refresh TTLs, `UPLOAD_DIR`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL=llama3.2:1b`,
  Prometheus/Grafana ports, `CORRELATION_HEADER`), each with a safe local default (AC-7).

Note: this task depends on other pods' Dockerfiles existing at expected paths
(`apps/*/Dockerfile`, `services/*/Dockerfile`); during this pod's build these paths may
not exist yet, so `docker-compose.yml` is written against the **agreed path convention**
from `ARCHITECTURE.md` and gets a final `docker compose config`/`up` smoke test at
integration time once all pods are merged.

Validation: `docker compose config` (schema/ref validation) now; `docker compose up`
end-to-end smoke test deferred to integration (Tech Lead), since it needs every pod's
Dockerfile.

---

## T4 — CI pipeline with nx affected

Covers US-4: AC-12, AC-13, AC-14.

Files:
- `.github/workflows/ci.yml`:
  - Checkout with full history (`fetch-depth: 0`) so `nx affected` can diff against
    `origin/main`.
  - `pnpm install --frozen-lockfile` (matches `.factory/commands.json` `install`).
  - `nx affected -t lint typecheck test build --base=origin/main --head=HEAD` (matches
    `.factory/commands.json` `test`) — fails the job (and PR) on any lint/typecheck error
    (AC-12, AC-13).
  - Nx Cloud **or** a GitHub Actions cache step keyed on `nx.json`/lockfile hash for
    `.nx/cache`, so unaffected projects are skipped/replayed from cache (AC-14).
  - Coverage thresholds enforced as part of each project's Vitest `test` target
    (`packages/tsconfig`/project-level `vitest.config.ts` owned by each pod), CI just
    needs `test` to fail the job when thresholds aren't met — no separate CI step needed.

Validation: workflow syntax validated with `actionlint` or `gh workflow view` if
available; behavior confirmed at integration time by pushing a no-op branch and
confirming `nx affected` reports zero affected projects.

---

## Sequencing & cross-pod dependencies

1. T1 + T2 first (root workspace config + shared libs) — every other pod needs
   `pnpm-workspace.yaml`, `nx.json` tag scheme, `packages/tsconfig`,
   `packages/eslint-config`, `packages/shared-types` to scaffold their own projects.
2. T3 and T4 can proceed in parallel with T1/T2 since they don't block other pods'
   day-to-day work, but both reference paths/ports other pods must match
   (`CONVENTIONS.md` should also note the expected `Dockerfile` location and `/metrics`,
   `/health` endpoint paths expected by `docker-compose.yml`/`prometheus.yml`).
3. Full AC-1..AC-14 verification (especially AC-2, AC-3, AC-5 "single `docker compose up`
   starts everything") only closes out once all pods are merged — flagged for the
   integration pass, not this pod's own build step.

## Known gaps / open items for integration

- `packages/ui` (design-system pod) and each app/service's own `project.json` must be
  reconciled against the tag scheme/target shape defined here; fix any mismatches during
  integration rather than blocking this pod's own delivery.
- `docker compose up` full-stack smoke test requires every pod's Dockerfile; only
  `docker compose config` is validated in this pod's own task.
