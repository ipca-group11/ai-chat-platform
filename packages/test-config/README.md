# `@platform/test-config`

Shared Vitest coverage-threshold preset (US-29, AC-97, `STACK.md` decision #6). This
package is the single source of truth for the 80% line/statement/function/branch coverage
bar every `services/*` project and `packages/ui` must meet; it does **not** author any
pod's own unit tests — that is each pod's own responsibility (see AC-94 below).

## What's in here

- `coverage-thresholds.ts` — the raw `{ lines, statements, functions, branches }: 80`
  object, plus `appCoverageThresholds` (branches 75, for `apps/*`) and
  `e2eCoverageThresholds` (branches 70).
- `vitest.preset.ts` — `coveragePreset(options)` (a ready-to-use `test.coverage` fragment:
  `v8` provider, `text`+`lcov`+`json-summary` reporters (the last writes
  `coverage/coverage-summary.json`), the shared thresholds (overridable with
  `thresholds`), and sane default excludes
  for spec/test/story files) and `vitestPreset(options)` (a full `UserConfig` fragment
  adding a `node` test environment on top).

## Which projects must apply the thresholds

Every Node test project (AICHAT-34): `services/*`, `packages/*`, `apps/*` and `e2e`.
`testing/k6` is exempt (k6 runtime, no Node source). The package is TypeScript source
(imports carry the `.ts` extension), and Node strips the types when a Vite config loads it, so no
build step is needed (a clean checkout without `dist/` works for `vite build` and the Dockerfiles).

## How to opt a project's `test` target into failing on an unmet threshold

In the project's own `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { coveragePreset } from "@platform/test-config";

export default defineConfig({
  test: {
    environment: "node", // or "jsdom" for packages/ui
    include: ["src/**/*.spec.ts"],
    coverage: coveragePreset({
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"], // project-specific extras, e.g. bootstrap entrypoints
    }),
  },
});
```

Because the project's own `test` target already runs `vitest run --coverage` (see any
`project.json` in this repo for the pattern), and Vitest's `coverage.thresholds` fails the
process with a non-zero exit code when unmet, this automatically makes `nx affected -t
test` fail in CI the moment a PR drops a project below 80% — no separate CI step needed.

## Testability expectations (AC-94)

This package only defines and documents the threshold; each pod authors and owns its own
Vitest suite against its own business logic, inside its own `apps/*`/`services/*`:

- Every `services/*` project's unit tests live next to the code they cover
  (`src/**/*.spec.ts`), covering request handlers, validation, and business logic — not
  just the "happy path" of each acceptance criterion the pod's PLAN.md assigns it.
- `conversation-service` (owned by the `chat` pod) additionally mocks the LLM/HTTP calls
  for every provider adapter (Ollama, OpenAI, Anthropic) in its own unit tests — no live
  network calls are allowed from `vitest run`.
- `packages/ui` (owned by `design-system`) covers hooks/model code; Storybook stories
  themselves are exempted from the coverage count (see the default `exclude` above) since
  their a11y coverage is tracked separately (AC-19/20, `@storybook/addon-a11y`).

See also the "Testing strategy & coverage targets" section of
`docs/pods/quality-observability/PLAN.md` for how this fits alongside contract tests
(`@platform/pact-config`), load tests (`testing/k6`), and E2E (`e2e/`).

## Guard: no test target may skip coverage (AICHAT-118)

`packages/workspace-config/src/coverage-guard.test.ts` checks every project with a `test`
target: the Nx command and the `package.json` script must run `vitest run --coverage`, and the
Vitest config must import `@platform/test-config`. The exempt lists live in
`packages/workspace-config/src/coverage-guard.ts`, each entry with a reason:

| Project | Exempt from | Reason |
|---|---|---|
| `testing/k6` | coverage and preset import | k6 runtime, not Node: the suite only asserts on the script text |
| `packages/test-config` | preset import only | it defines the preset and imports it relatively |
| `packages/eslint-config` | preset import only | would create a dependency cycle with `@platform/test-config`; keeps identical thresholds inline |
