# Platform conventions

This doc is the contract every other pod (`auth`, `chat`, `settings`, `design-system`,
`shell`, `quality-observability`, ...) should follow when adding its own `apps/*` /
`services/*` / `packages/ui` project on top of the workspace scaffolding this pod
(`platform-foundation`) owns. Copy the shapes below rather than inventing new ones, so
`nx run-many`/`nx affected` and the module-boundary lint rule work uniformly across the
whole repo (US-1 AC-2, AC-3, AC-4).

## 1. `project.json` target shape

Every project (`apps/*`, `services/*`, `packages/*`) needs a `project.json` next to its
`package.json` with this shape (adjust `sourceRoot`/`projectType`/commands per project,
keep the target names and tag scheme identical):

```jsonc
{
  "name": "<project-name>",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "<apps|services|packages>/<name>/src",
  "projectType": "application" | "library",
  "tags": ["type:app" | "type:service" | "type:package", "scope:<shell|auth|chat|settings|shared>"],
  "targets": {
    "lint": {
      "executor": "nx:run-commands",
      "options": { "command": "eslint src --max-warnings=0", "cwd": "<projectRoot>" }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "options": { "command": "tsc --noEmit -p tsconfig.json", "cwd": "<projectRoot>" }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": { "command": "vitest run --coverage", "cwd": "<projectRoot>" }
    },
    "build": {
      "executor": "nx:run-commands",
      "options": { "command": "<vite build | tsc -p tsconfig.build.json>", "cwd": "<projectRoot>" },
      "outputs": ["{projectRoot}/dist"]
    }
    // apps/* (and packages/ui) also add:
    // "serve":      { "executor": "nx:run-commands", "options": { "command": "vite", "cwd": "<projectRoot>" } }
    // packages/ui also adds:
    // "storybook":  { "executor": "nx:run-commands", "options": { "command": "storybook dev -p 6006", "cwd": "<projectRoot>" } }
  }
}
```

`lint`/`typecheck`/`test`/`build` are every project's four required targets (US-1 AC-3);
`targetDefaults` in the root `nx.json` already wires their caching/`dependsOn`/`outputs` —
project-level `project.json` only needs to declare *how* to run each target, not the
caching behavior.

## 2. Tag scheme (module boundaries, US-1 AC-4)

- `type:app` — `apps/shell`, `apps/mfe-auth`, `apps/mfe-chat`, `apps/mfe-settings`.
- `type:service` — `services/auth-service`, `services/conversation-service`.
- `type:package` — `packages/ui`, `packages/shared-types`, `packages/eslint-config`,
  `packages/tsconfig`.
- `scope:shell` / `scope:auth` / `scope:chat` / `scope:settings` / `scope:shared` — one
  scope tag per project, matching the domain it belongs to (`packages/*` are always
  `scope:shared`).

Enforced by `@platform/eslint-config`'s `base` preset (`@nx/enforce-module-boundaries`):
`type:app` and `type:service` may only depend on `type:package`; `type:package` may only
depend on other `type:package`. An app can never import another app or a service
directly, and a service can never import another service or an app.

Note: `@nx/enforce-module-boundaries` needs Nx's cached project graph to resolve tags —
it is a silent no-op (prints a `No cached ProjectGraph is available` warning, not a lint
error) when `eslint` is invoked directly instead of through `nx run <project>:lint` /
`nx run-many` / `nx affected`. Always lint through Nx (as CI does, see §5) so the rule
actually runs.

For projects with no `package.json`-adjacent `project.json` (rare — only for genuinely
target-less packages), tags can instead be declared via the `"nx": { "tags": [...] }`
key inside that project's `package.json` (see `packages/tsconfig/package.json`).

## 3. `tsconfig.json` — extend the shared bases (US-3 AC-10)

Every project's own `tsconfig.json` extends one of `packages/tsconfig`'s bases (never
copies compiler options ad hoc):

- `packages/tsconfig/base.json` — strict mode, `packages/*` that are consumed by both
  frontend and backend (e.g. `packages/shared-types`).
- `packages/tsconfig/react.json` — extends `base.json` + DOM/JSX libs, for `apps/*` and
  `packages/ui`.
- `packages/tsconfig/node.json` — extends `base.json` + `NodeNext` module resolution +
  Node types, for `services/*` only. **Because `NodeNext` requires explicit file
  extensions on relative imports (`./foo.js`, not `./foo`)**, prefer `base.json` (plain
  `Bundler` resolution) for any package that is also consumed by a Vite-bundled frontend
  (e.g. `packages/shared-types`) — only use `node.json` for code that only ever runs
  under Node (`services/*` source, not shared libraries).

`shared-types`'s own `tsconfig.json`/`tsconfig.build.json` under
`packages/shared-types/` is a worked example: `tsconfig.json` (`noEmit: true`, used by
the `typecheck` target) and `tsconfig.build.json` (extends it, `noEmit: false` +
declarations, used by the `build` target).

### ⚠️ TypeScript 7.0.2 / typescript-eslint compatibility (read before adding lint deps)

`STACK.md` mandates `typescript@7.0.2` for building and typechecking every project — keep
using it for your project's own `tsc`/`typecheck`/`build` targets, and declare it as an
explicit `typescript: "7.0.2"` devDependency in your project's own `package.json` (don't
rely on hoisting).

However, as of this build, neither `typescript-eslint@8.70.1` nor `@nx/eslint-plugin`
support TS 7's native compiler API yet (they throw/crash at `require("typescript")` time —
see https://github.com/typescript-eslint/typescript-eslint/issues/10940). `@platform/eslint-config`
works around this by pinning its **own** `typescript` devDependency to `6.0.3` (see
`packages/eslint-config/package.json` and the comment in `packages/eslint-config/src/base.js`) —
pnpm's per-package dependency isolation means this only affects what the lint tooling
resolves internally; it does not change what `typescript` your project's own `tsc`
resolves to. You do not need to do anything extra to get working lint — just depend on
`@platform/eslint-config` normally. Root's own `typescript` devDependency (consumed by Nx's
project-graph plugin, not by any app/service code) is pinned to `6.0.3` for the same
reason; this is a monorepo-tooling-only exception; it does not change the mandated
`7.0.2` you must use for your own project's `build`/`typecheck` targets.

## 4. ESLint (US-3 AC-9, AC-11)

Each project's `eslint.config.ts`:

```js
import { react } from "@platform/eslint-config"; // apps/*, packages/ui
// import { node } from "@platform/eslint-config"; // services/*
// import { base } from "@platform/eslint-config"; // packages/shared-types, other neutral libs

export default [...react];
```

The `base` preset (which `react`/`node` both extend) wires up `typescript-eslint`
recommended rules, `@nx/enforce-module-boundaries` (§2), and the local
`platform/feature-folder-boundaries` rule, which enforces the feature-folder convention
from `SPEC.md` §3.3: inside any `src/features/<feature>/**` folder, you may only import
(a) files within your own feature, (b) `src/shared/**`, or (c) another feature's public
API — i.e. the bare `features/<other>` specifier or its `index.ts`, never a deep path
into `features/<other>/**` internals.

## 5. Docker / Compose conventions (US-2 AC-5, AC-6)

`compose.yaml` (owned by this pod) expects, by path convention:

- `apps/<name>/Dockerfile` for `shell`, `mfe-auth`, `mfe-chat`, `mfe-settings`.
- `services/<name>/Dockerfile` for `auth-service`, `conversation-service`.

Each Dockerfile's build context is the repo root (so it can `COPY` the shared
`packages/*`); the image's `CMD` should serve on the port below via the `PORT` env var
(already set by `compose.yaml`; default it in your own app/service too so `pnpm
dev` outside Docker still works):

| Service | Port | Health check | Metrics |
|---|---|---|---|
| `shell` | 3000 | `GET /` (200) | — |
| `mfe-auth` | 3001 | `GET /` (200) | — |
| `mfe-chat` | 3002 | `GET /` (200) | — |
| `mfe-settings` | 3003 | `GET /` (200) | — |
| `auth-service` | 4001 | `GET /health` (200 JSON `{ "status": "ok" }`) | `GET /metrics` (Prometheus text format) |
| `conversation-service` | 4002 | `GET /health` (200 JSON `{ "status": "ok" }`) | `GET /metrics` (Prometheus text format) |
| `postgres` | 5432 | built-in `pg_isready` | — |
| `ollama` | 11434 | `GET /` (200) | — |
| `prometheus` | 9090 | — | — |
| `grafana` | 3300 | — | — |

`services/*` **must** implement `/health` and `/metrics` at those exact paths —
`observability/prometheus.yml` (this pod) scrapes `/metrics` on `auth-service:4001` and
`conversation-service:4002`, and `compose.yaml`'s healthchecks poll `/health`.

## 6. CI (US-4)

CI (`.github/workflows/ci.yml`, owned by this pod) runs
`nx affected -t lint typecheck test build --base=origin/main --head=HEAD` — matching
`.factory/commands.json`'s `test` command exactly. There is no separate per-pod CI config
to add; once your `project.json` exists with the four required targets, `nx affected`
picks it up automatically.
