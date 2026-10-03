---
title: "AICHAT-144 · Mock server: work log"
---

# AICHAT-144 · Mock server: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-144](https://ipca-grupo11.atlassian.net/browse/AICHAT-144) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-144-mock-server` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which mocks are in scope (README §5)? | LLM providers (Anthropic, OpenAI), auth-service and conversation-service APIs, MFE remotes and the telemetry sink | Owner |
| Tooling agreed | Met | Stack and location? | Node + Express, one process with one router per mock, Nx project `testing/mock-server`, Docker image, compose profiles | Owner |
| Target environment available | Met | Where does it run? | Locally (Docker compose profiles) and in GitHub Actions | Owner |
| App change for LLM base URLs | Met | May the provider registry read `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL`? | Yes, defaults unchanged, one commit (plan decision D3) | Owner |
| Stateful backend flows | Met | Which conversation-service flows keep state? | Chats and messages in memory (send, stream, edit, cancel, retry); settings, attachments and members are canned seed data | Owner |
| E2E in CI (AICHAT-153) | Met | How far do we go with the failing e2e workflow? | Make the chat flows pass against the mock; the other failing specs stay with AICHAT-4/5 | Owner |

Blockers: none

## 2. Environment

![Tool versions](evidence/00-environment.png)

| Tool | Version | Install |
|---|---|---|
| macOS | 26.3 (Darwin 25.3.0) | — |
| Node | `node -v` → v24.9.0 | project engines |
| pnpm | `pnpm -v` → 10.4.0 | `corepack enable` |
| Docker | `docker --version` → Docker version 29.4.0 | Docker Desktop |
| Express | 4.22.3 (`^4.22.3`, same as auth-service; see `testing/mock-server/package.json`) | `pnpm install` |

## 3. Steps

### US1 · Make LLM provider base URLs configurable by env ([AICHAT-43](https://ipca-grupo11.atlassian.net/browse/AICHAT-43))

**What and why.** Both LLM adapters already accept a `baseUrl`, but `createProviderRegistry()` built them with no configuration, so the URLs were fixed to the real APIs. The registry now reads `ANTHROPIC_BASE_URL` and `OPENAI_BASE_URL` (declared in `shared/env.ts`, validated as URLs). When the variables are not set the defaults stay `https://api.anthropic.com` and `https://api.openai.com`. This is the only change to application code in this epic; it lets the services call the mock server instead of a paid API.

**Files.**
- `services/conversation-service/src/shared/env.ts`: two new variables with the real API hosts as defaults.
- `services/conversation-service/src/features/llm-adapters/registry.ts`: `createProviderRegistry(source = process.env)` passes the base URLs to the adapters.
- `services/conversation-service/src/features/llm-adapters/registry.spec.ts`: unit tests for the defaults and for each variable.
- `services/conversation-service/.env.example`: documents the two variables.

**How to run.**

```sh
pnpm exec nx test conversation-service
```

**How to repeat it manually.**

1. Start conversation-service with `ANTHROPIC_BASE_URL=http://localhost:4010/anthropic` (or `OPENAI_BASE_URL=http://localhost:4010/openai`).
2. Send a message in a chat that uses that provider.
3. Expected output: the request goes to the URL you set (`/v1/messages` or `/v1/chat/completions` under it). Without the variables it goes to the real API as before.

**Result.** The registry test stubs `fetch`, sends one message through each adapter and checks the URL that was called: the defaults without variables, the custom host with each variable, and an error for a value that is not a URL.

![Registry base URL tests](evidence/01-base-url-unit-test.png)

**Problems and fixes.** The adapters keep `baseUrl` private, so the test checks the URL seen by a stubbed `fetch` instead of reading the field.

### US2 · Mock server project, admin endpoints and Docker image ([AICHAT-60](https://ipca-grupo11.atlassian.net/browse/AICHAT-60))

**What and why.** `testing/mock-server` is a new Nx project (Node and Express, TypeScript) that will stand in for the LLM providers and the backend services in tests. This story builds the frame the other stories fill: one Express app, one router per mock (`anthropic`, `openai`, `auth`, `conversation`, `remotes`, `collect`, empty for now), a small registry so each mock lives in its own file, and a scenario registry shown by `/__admin/scenarios` (empty until a story registers scenarios). Runs are repeatable: a seeded generator (`SEED`) drives every random choice. Tuning comes from the environment: `LATENCY_MS` delays every mock response, `ERROR_RATE` fails that share of requests with a 500, and `TTFT_MS`, `TOKEN_INTERVAL_MS`, `TOKENS` are read into the config for the LLM mocks. The admin endpoints are never delayed or failed.

How a mock is added: create `src/routers/<name>.router.ts` that exports a `MockModule` (`name`, `mountPath`, optional `scenarios`, `createRouter(ctx)`) and add one import line and one list entry in `src/routers/index.ts`. `ctx.onReset(hook)` clears a mock's state on `/__admin/reset`.

**Files.**
- `testing/mock-server/project.json`, `package.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts` (new): lint, typecheck, test (with the shared `coveragePreset`, thresholds 80) and build targets.
- `testing/mock-server/src/app.ts`, `main.ts`, `config.ts`, `prng.ts`, `middleware.ts`, `registry.ts` (new): the app, env parsing, seeded generator, latency and error middleware, mock and scenario registries.
- `testing/mock-server/src/routers/*.router.ts`, `index.ts` (new): the six mock routers and the list of mounted mocks.
- `testing/mock-server/src/admin/admin.router.ts` (new): the `/__admin` endpoints.
- `testing/mock-server/scripts/build.mjs` (new): bundles the server into one file with esbuild.
- `testing/mock-server/Dockerfile`, `.env.example` (new): multi-stage image running as a non-root user; documented variables.
- `.dockerignore`, `pnpm-workspace.yaml`, `packages/workspace-config/src/coverage-guard.js`: the project is part of the workspace, sent to the Docker build, and checked by the coverage guard test.

**How to run.**

```sh
pnpm exec nx run-many -t lint typecheck test build -p mock-server
pnpm exec nx serve mock-server              # listens on http://localhost:4010
docker build -f testing/mock-server/Dockerfile -t ai-chat-mock-server . && docker run --rm -p 4010:4010 ai-chat-mock-server
```

**How to repeat it manually.**

1. Start the server with `pnpm exec nx serve mock-server` (or the Docker commands above).
2. Run `curl localhost:4010/__admin/health`, `curl localhost:4010/__admin/scenarios` and `curl -X POST localhost:4010/__admin/reset`.
3. Expected output: `{"status":"ok"}`, `{"scenarios":[]}` and `{"status":"reset"}`. Any other path answers 404 with `{"error":{"code":"not_mocked",...}}`.

**Result.** Lint, typecheck, build and the tests pass, coverage is above 80% on all four metrics, the admin endpoints answer as expected, and the image builds, starts as user `app` and reports `healthy`.

![Mock server tests with coverage](evidence/02-mock-server-tests.png)

![Admin endpoints](evidence/03-admin-endpoints.png)

![Docker build and health check](evidence/04-docker-build-run.png)

**Problems and fixes.** `@app/shared-types` is TypeScript source with extensionless imports, so the server cannot be compiled with `tsc` and run on plain Node. The build bundles everything with esbuild into `dist/main.cjs`; the image only needs Node and that file. The `.dockerignore` excluded the whole `testing` folder, so it now lets `testing/mock-server` through. The coverage guard test lists the projects by folder, so `testing/mock-server` was added to it.

### US3 · Mock data: named seed datasets and data factories ([AICHAT-160](https://ipca-grupo11.atlassian.net/browse/AICHAT-160))

**What and why.** The mocks need believable data that tests can also build on their own. `createFactories(seed)` returns factories for users, chats, members, messages (plain, assistant, with reasoning text, and with web fetch parts), attachments and provider keys. Every object has the shape of `@app/shared-types` (the tests check it against the zod schemas) and the same seed gives the same ids, text and dates. Six datasets use them: `empty`, `default` (two users, chats with a reasoning answer and a web fetch answer, provider keys), `many-chats` (220 chats), `long-conversation` (one chat, 500 messages), `shared-chats` (chats with four members) and `attachments` (one file of each allowed type). A dataset is loaded with `POST /__admin/seed/<dataset>` or with `MOCK_DATASET` at start-up, and `/__admin/reset` goes back to `MOCK_DATASET`. `GET /__admin/data` returns the loaded records. The package entry `src/data/index.ts` (`@platform/mock-server`) has no server code, so Vitest and Playwright import the same factories.

**Files.**
- `testing/mock-server/src/data/factories.ts`, `datasets.ts`, `types.ts`, `index.ts` (new): factories, datasets, record types and the package entry.
- `testing/mock-server/src/data/*.spec.ts` (new): schema, determinism and size checks for every dataset.
- `testing/mock-server/src/admin/admin.router.ts`, `app.ts`, `registry.ts`: the data store (`ctx.store`) and the seed and data endpoints.

**How to run.**

```sh
pnpm exec nx test mock-server
curl -X POST localhost:4010/__admin/seed/many-chats      # with the server running
```

**How to repeat it manually.**

1. Start the server (`pnpm exec nx serve mock-server`), or with `MOCK_DATASET=default`.
2. Seed each dataset with `curl -X POST localhost:4010/__admin/seed/<name>`.
3. Expected output: a JSON body with the dataset name and the number of records, for example `many-chats` with 220 chats and `long-conversation` with 500 messages. An unknown name answers 404 and lists the valid names. In a test: `import { createFactories, buildDataset } from "@platform/mock-server"`.

**Result.** The counts match the acceptance criteria for every dataset.

![Seeding the datasets](evidence/05-seed-datasets.png)

**Problems and fixes.** The shared member type has no chat id, so the dataset type adds one (`MockMember`). The shared provider key record keeps only the last four characters, so `MockProviderKey` adds a fake `apiKey` and the user id for the mock. We confirmed once that a Playwright test can import the package entry and build a 220-chat dataset, then removed the temporary spec because the `e2e` project does not use the package yet.

## 4. How to run everything

```sh
# all checks added by this epic, from the repo root
```

## 5. Results

| Metric | Before | After |
|---|---|---|
| … | … | … |

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|
| … | ✅ | [link](evidence/…) |

## 7. Notes for the report

- What was found
- What was fixed / waived
- Lessons learned
