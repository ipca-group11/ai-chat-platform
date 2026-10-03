---
title: "AICHAT-20 · Snapshot testing: work log"
---

# AICHAT-20 · Snapshot testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-20](https://ipca-grupo11.atlassian.net/browse/AICHAT-20) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-20-snapshot-testing` |
| Started / finished | 2026-10-03 / 2026-10-03 |
| Pull requests | pending (opened after the CI run) |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | What do we snapshot? | Only the DTOs and wire outputs of README §4.2 (shared-types schemas, SSE frames, error bodies); never component trees | Team (owner delegated) |
| Tooling agreed | Met | Which tools? | Vitest inline and file snapshots, a serializer that normalises UUIDs and dates, and the `vitest/no-large-snapshots` lint rule plus a rule against snapshots in `.tsx` tests | Team (owner delegated) |
| Target environment available | Met | Where does it run? | Locally and in GitHub Actions (`nx affected -t test lint`); e2e not run | Team (owner delegated) |
| DTOs listed | Met | Which schemas? | README §4.2 | Team (owner delegated) |
| Reviewing snapshot changes | Met | How do we stop blind `-u` updates? | The PR template asks "Why did this snapshot change?" | Team (owner delegated) |
| Overlap with Pact (AICHAT-11) and schema validation (AICHAT-12) | Met | Do we duplicate them? | No: snapshots check shape stability only | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS | 26.3 | n/a |
| Node | `node -v` → v24.21.0 | `nvm install` (version in `.nvmrc`) |
| pnpm | `pnpm -v` → 10.4.0 | `corepack enable` |
| Docker | `docker --version` → 29.4.0 (not needed for this epic) | n/a |
| Vitest / @vitest/eslint-plugin | vitest 5.0.1, @vitest/eslint-plugin 1.6.27 (new, in `packages/eslint-config`) | `pnpm install` |

![Node and pnpm versions](evidence/00-environment.png)

## 3. Steps

### US1 · Canonical DTO fixtures ([AICHAT-42](https://ipca-grupo11.atlassian.net/browse/AICHAT-42))

**What and why.** Every snapshot starts from a known input, so we keep one valid example of each DTO in README section 4.2 in one module. The same fixtures can serve the visual mocks (AICHAT-19) and Pact (AICHAT-11). We looked at the data factories of `@platform/mock-server`, but they follow the services, which differ from shared-types (see US5), so they do not fit these schemas. The fixtures are plain data next to the schemas. Ids are real UUIDs and dates real ISO strings on purpose, so the serializer of US2 has something to normalise.

**Files.**
- `packages/shared-types/src/__fixtures__/index.ts` (new): 15 fixtures, each a schema plus an input: `userProfile`, `authResponse`, `accessTokenClaims`, `chat`, `chatMember`, `message`, `attachment`, the six SSE events, `errorResponse` (built with `toErrorResponse`) and `testConnectionResponse`.
- `packages/shared-types/src/__fixtures__/index.test.ts` (new): parses every fixture with its schema, and checks the list is the one in the README.

**How to run.**

```sh
pnpm --dir packages/shared-types exec vitest run src/__fixtures__/index.test.ts --reporter=verbose
```

**How to repeat it manually.**

1. Run the command above.
2. Expected output: 16 tests pass, one per fixture plus the list check.
3. Break a fixture, for example set `status: "done"` to `status: "ok"` in the `sseWebFetch` fixture. Expected: the test for that fixture fails with the zod error. Undo the change.

**Result.** All 15 fixtures pass `schema.parse`.

![Fixture tests](evidence/01-fixtures-parse.png)

**Problems and fixes.** The unit-test guard of `workspace-config` wants a test file named after every source file, so the test is `index.test.ts` and not `fixtures.test.ts` (found by the first `nx affected` run).

### US2 · Snapshot tests for shared DTOs ([AICHAT-59](https://ipca-grupo11.atlassian.net/browse/AICHAT-59))

**What and why.** The snapshots pin the serialised shape of each DTO, so a renamed or added field shows up in review. A Vitest serializer replaces UUIDs with `<uuid>` and ISO date-times with `<date>`, so the output is stable between runs. It lives in `@platform/test-config` because both services and shared-types already depend on it, and each project turns it on with `snapshotSerializers: [snapshotSerializerPath]` in its `vitest.config.ts`. Small outputs are inline snapshots. The list of all six SSE events is a file snapshot, to show both kinds.

**Files.**
- `packages/test-config/snapshot-serializer.ts` (new), its spec `snapshot-serializer.spec.ts` (new) and `index.ts`: `snapshotSerializer`, `snapshotSerializerPath`, `normalizeSnapshotText`.
- `packages/shared-types/vitest.config.ts`: registers the serializer.
- `packages/shared-types/src/__fixtures__/dto-snapshots.test.ts` (new) and `__snapshots__/dto-snapshots.test.ts.snap` (new): snapshots of `schema.parse(fixture)` for every DTO of section 4.2, and of `toErrorResponse()`.

**How to run.**

```sh
pnpm --dir packages/shared-types exec vitest run
```

**How to repeat it manually.**

1. Run the command above. Expected: all tests pass, no snapshot written.
2. Add `pinned: z.boolean().default(false)` to `chatSchema` in `packages/shared-types/src/chat/chat.ts` and run again. Expected: the `chat` snapshot fails and the diff shows `+ "pinned": false`. Undo the change.
3. To accept an intended change, run `vitest -u` on your machine and explain the change in the pull request. Never use `-u` in CI.
4. Run with `CI=true` and a test that has no stored snapshot. Expected: it fails instead of writing the snapshot.

**Result.** Snapshots pass with ids and dates replaced. A DTO change fails the snapshot and the diff names the field. In CI mode a missing snapshot fails (item 4 above, which answers step 7 of the README plan).

![Snapshot run](evidence/02-snapshot-run.png)

![A DTO change fails the snapshot](evidence/03-snapshot-fails-on-dto-change.png)

![A missing snapshot fails in CI mode](evidence/04-missing-snapshot-fails-in-ci.png)

**Problems and fixes.** The serializer test could not use `@vitest/pretty-format` (only a transitive dependency), so it calls `serialize` with a small stand-in printer. Coverage thresholds stay met (shared-types 96.8% lines, test-config 100%).

### US3 · Snapshot tests for SSE frames and error bodies ([AICHAT-77](https://ipca-grupo11.atlassian.net/browse/AICHAT-77))

**What and why.** These are the wire outputs that the browser and the other service see. For conversation-service we snapshot the exact `event:`/`data:` text of `writeSseEvent` for all eight event types (the real service also sends `message` and `started`). For both services we snapshot status and body of the error middleware for HttpError with 400, 401, 403, 404, 409, 422 and 500, plus a validation error with field errors, the unknown route and an unexpected error redacted to a 500. conversation-service also has the multer upload error. The existing specs check single fields; these pin the whole body.

**Files.**
- `services/conversation-service/src/features/streaming/sse.snapshot.spec.ts` (new) and its `.snap`.
- `services/conversation-service/src/shared/error-handler.snapshot.spec.ts` (new) and its `.snap`.
- `services/auth-service/src/shared/error-middleware.snapshot.spec.ts` (new) and its `.snap`.
- `services/*/vitest.config.ts`: register the serializer.

**How to run.**

```sh
pnpm --dir services/conversation-service exec vitest run snapshot
pnpm --dir services/auth-service exec vitest run snapshot
```

**How to repeat it manually.**

1. Run both commands. Expected: 13 and 10 tests pass.
2. In `services/auth-service/src/shared/error-middleware.ts` change `"Internal server error"` to `"Something went wrong"` and run the auth command. Expected: the 500 snapshots fail with `- "message": "Internal server error"` and `+ "message": "Something went wrong"`. Undo the change.

**Result.** All wire snapshots pass, and a change of an error message fails the snapshot.

![Wire snapshots](evidence/05-wire-snapshots-run.png)

![An error body change fails](evidence/06-error-body-change-fails.png)

**Problems and fixes.** The correlation id in the error bodies is a UUID in the tests, so it shows as `<uuid>` in the snapshots, which is intended. We left out the 5xx log call by giving the test request no logger.

### US4 · Lint rule against component-tree and large snapshots ([AICHAT-95](https://ipca-grupo11.atlassian.net/browse/AICHAT-95))

**What and why.** The policy is that only DTOs and wire output are snapshotted. Two rules enforce it in `packages/eslint-config`, so every project gets them from the shared preset. `platform/no-component-snapshots` (new, in the local plugin) reports `toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot` and the two `toThrowErrorMatching...Snapshot` matchers in `*.test.tsx` and `*.spec.tsx` files. `vitest/no-large-snapshots` from `@vitest/eslint-plugin` (it was not in the repo; added as a dev dependency of `eslint-config`) fails an inline snapshot or `.snap` over 50 lines in `*.test|spec.ts|tsx` files. We also added `.github/pull_request_template.md`, with a checklist that asks "Why did this snapshot change?".

**Files.**
- `packages/eslint-config/src/rules/no-component-snapshots.ts` (new) and `.test.ts` (new, RuleTester).
- `packages/eslint-config/src/local-plugin.ts`, `base.ts`: register the rule and add the two config entries.
- `packages/eslint-config/src/base.test.ts`, `local-plugin.test.ts`: lint-fixture tests (a `.tsx` test with a snapshot fails, the same code in `.ts` passes, a 60-line inline snapshot fails).
- `packages/eslint-config/package.json`, `pnpm-lock.yaml`: `@vitest/eslint-plugin`.
- `.github/pull_request_template.md` (new).

**How to run.**

```sh
pnpm --dir packages/eslint-config exec vitest run
```

**How to repeat it manually.**

1. Create `apps/mfe-chat/src/snapshot-lint-fixture.test.tsx` with a test that renders a button and calls `expect(container).toMatchSnapshot()`.
2. Run `pnpm --dir apps/mfe-chat exec eslint src/snapshot-lint-fixture.test.tsx`.
3. Expected: one error, `platform/no-component-snapshots`, and exit code 1. Delete the file.

**Result.** The rule fails the fixture `.tsx`. The 60 tests of `eslint-config` pass, coverage 100% lines.

![Lint fails on a .tsx snapshot](evidence/07-lint-rule-fails-on-tsx-snapshot.png)

![eslint-config tests](evidence/08-eslint-config-tests.png)

**Problems and fixes.** The `no-large-snapshots` limit is 50 lines, as in the README plan. Our own rule of thumb (inline up to about 20 lines, file snapshot above) is in the comment of `dto-snapshots.test.ts` and is not enforced by the linter. The existing `react` preset test counts entries after the base ones, so we added the new entries to `base`, where they apply to every preset.

### US5 · Detect SSE type drift between mfe-chat and shared-types ([AICHAT-113](https://ipca-grupo11.atlassian.net/browse/AICHAT-113))

**What and why.** mfe-chat does not use shared-types for the stream events and has its own `SSEEvent`. The two have drifted: mfe-chat has `message` and `started`, `done.stopped` and `error.retryable`; shared-types has `queued.position`. The conversation-service sends what mfe-chat expects. `docs/AICHAT-20/SSE-DRIFT.md` shows the two definitions side by side, links the wider list of shared-types against the services (kept in `docs/AICHAT-144/WORKLOG.md`, US15, not repeated) and has the text of the ticket for the chat owner. We raise the Jira ticket from that file. A test pins today's drift, so fixing it later updates the test on purpose.

**Files.**
- `docs/AICHAT-20/SSE-DRIFT.md` (new): the report and the ticket text.
- `apps/mfe-chat/src/shared/sse-drift.test.ts` (new): compares event names and field names of both definitions, pinned in an inline snapshot. A compile-time check makes an unlisted field of mfe-chat's `SSEEvent` a type error.

**How to run.**

```sh
pnpm --dir apps/mfe-chat exec vitest run src/shared/sse-drift.test.ts
```

**How to repeat it manually.**

1. Run the command above. Expected: 2 tests pass.
2. In `packages/shared-types/src/chat/sse.ts` add `retryable: z.boolean(),` to `sseErrorEventSchema` and run again. Expected: the drift test fails because the `error` entry is gone from the pinned difference. Undo the change.

**Result.** The test passes on today's drift and fails when one side changes.

![Drift test](evidence/09-sse-drift-test.png)

![A change in shared-types fails the drift test](evidence/10-sse-drift-change-fails.png)

**Problems and fixes.** The test only compares names. Optional against required (`done.stopped`, `queued.position`) is written in `SSE-DRIFT.md`, not checked, because the mfe-chat type has no runtime form to inspect. The Jira ticket for the chat owner is not created yet; it is raised from `SSE-DRIFT.md`.

## 4. How to run everything

```sh
# all checks added by this epic, from the repo root
pnpm --dir packages/test-config exec vitest run
pnpm --dir packages/shared-types exec vitest run
pnpm --dir packages/eslint-config exec vitest run
pnpm --dir services/conversation-service exec vitest run snapshot
pnpm --dir services/auth-service exec vitest run snapshot
pnpm --dir apps/mfe-chat exec vitest run src/shared/sse-drift.test.ts
# the full gate
pnpm exec nx affected -t lint typecheck test build --base=origin/integration/testing-epics
pnpm sast
gitleaks git --redact --log-opts=origin/integration/testing-epics..HEAD
# update snapshots after an intended change (locally, never in CI)
pnpm --dir <project> exec vitest run -u
```

## 5. Results

| Metric | Before | After |
|---|---|---|
| Snapshot assertions in the repo | 0 | 36 (12 shared-types, 13 conversation-service, 10 auth-service, 1 mfe-chat) |
| DTO fixtures in shared-types | 0 | 15, all pass `schema.parse` |
| Snapshot test files | 0 | 5 (`.snap` files: 4) |
| Component-tree snapshots | 0 | 0, and the lint rule blocks new ones |
| Tests in shared-types | 114 | 125 |
| Lint rules about snapshots | 0 | 2 (`platform/no-component-snapshots`, `vitest/no-large-snapshots`) |
| Known SSE drift mfe-chat vs shared-types | not recorded | recorded and pinned by a test |

![nx affected: lint, typecheck, test, build](evidence/11-affected-lint-typecheck-test-build.png)

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|
| One fixture per section 4.2 schema, each passing `schema.parse` (AICHAT-42) | ✅ | [01](evidence/01-fixtures-parse.png) |
| Snapshots for all section 4.2 schemas, UUIDs and dates normalised (AICHAT-59) | ✅ | [02](evidence/02-snapshot-run.png), [03](evidence/03-snapshot-fails-on-dto-change.png) |
| Snapshots of SSE frames and error middleware in both services (AICHAT-77) | ✅ | [05](evidence/05-wire-snapshots-run.png), [06](evidence/06-error-body-change-fails.png) |
| ESLint rule active in `packages/eslint-config`; a test `.tsx` with `toMatchSnapshot` fails lint (AICHAT-95) | ✅ | [07](evidence/07-lint-rule-fails-on-tsx-snapshot.png), [08](evidence/08-eslint-config-tests.png) |
| SSE drift reported with both definitions side by side (AICHAT-113) | ✅ file, Jira ticket to raise | [SSE-DRIFT.md](SSE-DRIFT.md), [09](evidence/09-sse-drift-test.png), [10](evidence/10-sse-drift-change-fails.png) |
| No component-tree snapshots remain | ✅ | none exist; rule blocks new ones |
| A missing snapshot fails in CI | ✅ | [04](evidence/04-missing-snapshot-fails-in-ci.png) |
| Coverage thresholds stay met | ✅ | [11](evidence/11-affected-lint-typecheck-test-build.png) |
| Lint, typecheck, test, build of affected projects, local | ✅ | [11](evidence/11-affected-lint-typecheck-test-build.png) |
| SAST (`pnpm sast`) | ✅ | [12](evidence/12-sast.png) |
| Secret scan (gitleaks) | ✅ | [13](evidence/13-gitleaks.png) |
| PR template asks "Why did this snapshot change?" | ✅ | `.github/pull_request_template.md` |
| CI: lint, typecheck, test, build | pending PR run | n/a |
| CI: secret scan and SAST | pending PR run | n/a |

## 7. Notes for the report

- What was found: the stream events of mfe-chat and shared-types have drifted (`message`, `started`, `done.stopped`, `error.retryable`, `queued.position`), and no build step caught it because mfe-chat does not import shared-types. The wider shared-types against services list was already in the AICHAT-144 work log and we reused it.
- What was added: a UUID and date normalising serializer in `@platform/test-config`, 15 canonical fixtures, 36 snapshot assertions on DTOs and wire output, two lint rules, a PR template.
- Decisions: snapshots are only for DTOs and wire output. The 50-line limit of `vitest/no-large-snapshots` follows the README plan. Our "inline up to about 20 lines" guideline is a comment, not a rule. Recommendation: after the chat owner fixes the drift, turn `sse-drift.test.ts` into a plain equality check.
- Flaky test seen once: `testing/mock-server` `conversation.router.spec.ts` ("hides the chats of other users") failed in one parallel `nx affected` run because the sign-in answered without a cookie; it passed alone and in the next runs. Not related to this epic; worth a look under AICHAT-144.
- Lessons: a test file named after its source file is required by the unit-test guard; `-u` must be a conscious step, which is why the PR template asks for the reason.
