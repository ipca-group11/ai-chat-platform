### US9 · mfe-settings: close the remaining unit-test gaps ([AICHAT-141](https://ipca-grupo11.atlassian.net/browse/AICHAT-141))

**What and why.** The analysis listed one file without a test and one tested only indirectly in `apps/mfe-settings`. Before writing anything we ran the inventory again: the MSW migration of the foundation stories had already added `api/auth.test.ts`, `api/testConnection.test.ts`, `hooks/useCurrentUserId.test.tsx` and `shared/correlation.test.ts`, so every file in `mfe-settings` now has a test next to it or an exempt entry. No new test was needed and no exempt entry is proposed for this project.

**Files.** None changed. Existing exempt entries: `main.tsx`, `routes.tsx` (bootstrap) and `features/api-keys/index.ts` (barrel).

**How to run.**

```bash
pnpm exec nx run mfe-settings:test
node scripts/unit-test/source-files.mjs --list | grep -E "apps/mfe-settings" | grep NO-TEST
```

**How to repeat it manually.** Run the second command: it prints nothing. The first one runs the 53 tests with coverage and checks the thresholds.

**Result.** 11 test files, 53 tests, statements 100 %, branches 91.01 %; thresholds met.

![mfe-settings tests with coverage](evidence/60-mfe-settings-coverage.png)

**Problems and fixes.** None. The gap had been closed by an earlier story, so this one only confirms it.

### US10 · auth-service: close the remaining unit-test gaps ([AICHAT-142](https://ipca-grupo11.atlassian.net/browse/AICHAT-142))

**What and why.** `shared/contracts/http.ts` exports runtime values (`CORRELATION_HEADER`, `getOrCreateCorrelationId`, `errorResponseSchema`, `toErrorResponse`), so it is tested instead of exempted as type-only. `shared/contracts/auth.ts` (the password policy, request and response schemas, token claims and lifetimes) also had no test and got one. The three files that were reached only through other tests (`correlation-id.ts`, `error-middleware.ts`, `jwt.ts`) already have their own `*.spec.ts` next to them, so nothing was missing there.

**Files.** `services/auth-service/src/shared/contracts/http.spec.ts`, `services/auth-service/src/shared/contracts/auth.spec.ts`.

**How to run.**

```bash
pnpm exec nx run auth-service:test
cd services/auth-service && pnpm exec vitest run src/shared/contracts
```

**How to repeat it manually.** Change `PASSWORD_MIN_LENGTH` in `auth.ts` to 6: the table in `auth.spec.ts` fails on `short1a`. Change the order of the two header lookups in `getOrCreateCorrelationId`: `http.spec.ts` fails.

**Result.** 19 new tests. The service has 16 test files and 95 tests; statements 95.32 %, branches 89.74 %, functions 96.07 %, lines 95.67 %. Thresholds met.

![auth-service contract tests](evidence/61-auth-service-contracts.png)

**Problems and fixes.** The `Prisma` client is generated, so a fresh checkout fails on `vitest run` until `prisma-generate` has run; the `nx` target does it first, so the commands above use `nx` for the whole service.

### US11 · conversation-service: unit tests for controllers and shared helpers ([AICHAT-123](https://ipca-grupo11.atlassian.net/browse/AICHAT-123))

**What and why.** The three controllers and the shared helpers were only reached through route tests, which hide the mapping details. Now each one has a focused test with a fake service:

- `shared/async-handler.ts`: resolved (next not called), rejected (error forwarded) and thrown inside the handler (error forwarded).
- `features/{chats,messages,attachments}/controller.ts`: parameters and body are parsed, the right service method is called with the right arguments (principal or user id), and the status and body are as agreed (201, 202, 204, wrapped `{ chat }`, `{ messages }`). Invalid input rejects with a `ZodError` before the service is called, a missing upload answers 400 `ATTACHMENT_REQUIRED`, and an empty `X-Llm-Api-Key` header counts as no key.
- `shared/contracts/auth.ts` and `shared/contracts/chat.ts` export Zod schemas and constants, so they are tested (not type-only). `features/attachments/schema.ts`, `shared/logger.ts` (redaction of the key header, cookies, authorization and password fields on real `pino` output) and `features/llm-adapters/types.ts` (`ProviderError`) got tests too.
- The capability tables `THINKING_STYLES`, `WEB_FETCH_TOOLS` and `VISION_MODEL_HINTS` are private to the adapters, so `llm-adapters/capability-tables.spec.ts` checks them through the public `supports*` methods and through the request each model produces. The cases are tables (one row per model id), including the ids where the order matters (`claude-opus-5-5` before `claude-opus-5`, `claude-opus-4-6` before `claude-opus-4`).

**Files.** `shared/async-handler.spec.ts`, `shared/logger.spec.ts`, `shared/contracts/auth.spec.ts`, `shared/contracts/chat.spec.ts`, `features/{chats,messages,attachments}/controller.spec.ts`, `features/attachments/schema.spec.ts`, `features/llm-adapters/types.spec.ts`, `features/llm-adapters/capability-tables.spec.ts`, helper `test-utils/fake-http.ts` (all under `services/conversation-service/src`).

**How to run.**

```bash
pnpm exec nx run conversation-service:test
cd services/conversation-service && pnpm exec vitest run src/features/llm-adapters/capability-tables.spec.ts
```

**How to repeat it manually.** Swap two rows of `THINKING_STYLES` in `anthropic.provider.ts` (put `claude-opus-5` above `claude-opus-5-5`): the table test for `claude-opus-5-5` fails. Remove `.catch(next)` in `async-handler.ts`: the rejected and thrown cases fail.

**Result.** 44 test files, 391 tests (2 todo that were already there); statements 98.45 %, branches 91.26 %, functions 97.9 %, lines 99.03 %. Thresholds met.

![controller and helper tests](evidence/62-conversation-controllers.png)
![capability tables](evidence/63-capability-tables.png)
![coverage of both services](evidence/68-coverage-services.png)

**Problems and fixes.** `pino` writes to stdout by default, so the first logger test printed the log line instead of asserting on it. The test now captures the options `createLogger` passes to `pino` and feeds the same options to the real `pino` writing to an in-memory stream.

### US12 · Shared packages and tooling: close the remaining unit-test gaps ([AICHAT-143](https://ipca-grupo11.atlassian.net/browse/AICHAT-143))

**What and why.**

- `packages/ui` `components/alert/alert.tsx`: the only design-system component without a test. It now checks the role, the three variants, class merging, ref forwarding and the title and description slots.
- `packages/eslint-config`: `base.js`, `node.js`, `react.js` and `local-plugin.js` are tested by linting small code fixtures with the real `ESLint` class and asserting which rules fire (unused variables with and without `_`, `import type`, `console`, deep imports between features, hooks called conditionally, missing `key`, Node globals). `local-plugin.js` is also run through `RuleTester`. The helper `src/test-utils/lint.js` is shared by the three preset tests.
- `e2e/src/fixtures/wait-for-stack-cli.ts`: the module runs on import, so the test loads it fresh with `waitForStack` mocked and checks the time budget (default 180000 ms, or `E2E_WAIT_TIMEOUT_MS`), exit code 0 when healthy, and exit code 1 plus the printed message when not (also for a non-`Error` rejection).
- Also in scope of "cover all of them": `e2e/src/fixtures/{auth-flows,chat-flows,settings-flows,test-users}.ts` are tested with a recording fake Playwright `Page` (`e2e/src/test-utils/fake-page.ts`), without a browser, and `packages/shared-types/src/chat/provider.ts` got a schema test. `e2e/vitest.config.ts` now measures all of `src/fixtures`.

Playwright was never started: only Vitest runs here.

**Files.** `packages/ui/src/components/alert/alert.test.tsx`, `packages/eslint-config/src/{base,node,react,local-plugin}.test.js`, `packages/eslint-config/src/test-utils/lint.js`, `e2e/src/fixtures/*.spec.ts` (five new), `e2e/src/test-utils/fake-page.ts`, `e2e/vitest.config.ts`, `packages/shared-types/src/chat/provider.test.ts`.

**How to run.**

```bash
pnpm exec nx run-many -t test -p ui eslint-config e2e shared-types
cd e2e && pnpm exec vitest run --coverage
```

**How to repeat it manually.** In `eslint-config/src/node.js` set `"no-console"` back to `"warn"`: the node preset test fails. Change `180_000` in `wait-for-stack-cli.ts`: the default-budget test fails.

**Result.** ui: 9 new tests. eslint-config: 45 tests. e2e: 50 tests, statements 91.91 %, branches 80.55 %. After this the inventory has no `NO-TEST` file in `mfe-settings`, `services`, `packages` or `e2e`.

![eslint-config tests](evidence/64-eslint-config-rules.png)
![Alert tests](evidence/65-ui-alert.png)
![e2e helper tests](evidence/66-e2e-helpers-unit.png)
![no file without a test left](evidence/67-no-test-left.png)

Final gate for the four stories (lint, typecheck, test and build for the six projects, then SAST):

![nx run-many](evidence/69-nx-run-many.png)
![sast](evidence/70-sast.png)

**Problems and fixes.** The shared `node` preset has no `URL` global, so a helper using `new URL(...)` failed `no-undef` in lint; the helper uses `import.meta.dirname` instead. The `eslint-config` coverage keeps measuring only `src/rules`, as before, because the package cannot import the shared preset (it would be a cycle); the preset files are covered by the behaviour tests above.
