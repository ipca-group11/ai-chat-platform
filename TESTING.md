# Running the tests

Prerequisites: Node 24.21+ (`nvm use 24`), `pnpm install`, and Docker running for the tests marked **(Docker)**. All commands run from the repo root unless noted. `BASE=origin/integration/testing-epics`.

---

# Contract tests (AICHAT-11)

```sh
# consumers write pacts/*.json from their real API client code (no Docker)
pnpm exec nx run-many -t pact:consumer
# providers replay those pacts against their real app with in-memory fakes (no Docker)
pnpm exec nx run auth-service:pact:verify
pnpm exec nx run conversation-service:pact:verify
```

Details, known failures and how to add a pact: `packages/pact-config/README.md`.

---

# API schema validation (AICHAT-12)

```sh
# specs, response schemas, invalid requests, stream events (no Docker)
pnpm exec nx run-many -t test -p auth-service conversation-service mfe-chat
# after changing a schema or a route: regenerate the committed specs, then the ZAP spec
pnpm --filter @app/auth-service openapi:generate && pnpm --filter @app/conversation-service openapi:generate
node scripts/dast/zap-spec.ts
# Schemathesis against the running stack (Docker); on macOS add the ST_DOCKER_ARGS / ST_*_URL variables of the work log
RATE_LIMIT_MAX=100000 pnpm mock:up
bash testing/schemathesis/run.sh
```

Details: `docs/AICHAT-12/WORKLOG.md`.

---

# Concurrency (AICHAT-13)

```sh
# queue races (deferred promises), N sends at once, retry/edit/cancel during a reply: 50 seeded runs each (no Docker)
cd services/conversation-service && pnpm exec vitest run src/features/queue src/integration/parallel-sends.spec.ts src/integration/stream-races.spec.ts
# double-click / double Enter on Send is one message (no Docker)
cd apps/mfe-chat && pnpm exec vitest run src/features/composer
# browser: owner and member send at the same moment, double-click on Send (Docker)
pnpm mock:up
cd e2e && BASE_URL=http://localhost:8000 pnpm exec playwright test --project=chromium src/tests/concurrent-sends.spec.ts
```

Details: `docs/AICHAT-13/WORKLOG.md`.

---

# SSE reconnection (AICHAT-9)

```sh
# client recovery (refetch on reconnect, Reconnecting…) and server disconnect/heartbeat (no Docker)
pnpm exec nx run-many -t test -p mfe-chat test-utils conversation-service
# browser: network drop mid-stream, drop over the end of the reply, server-side outage, long drop (Docker)
pnpm mock:up
cd e2e && BASE_URL=http://localhost:8000 pnpm exec playwright test --project=chromium \
  src/tests/sse-reconnection.spec.ts src/tests/support/drop-proxy.spec.ts
# an idle stream through the proxies: heartbeats every 15 s, exit 1 if cut (Docker, or --base https://<VM>)
node scripts/sse/idle-stream.ts --minutes 0.75
```

Details: `docs/AICHAT-9/WORKLOG.md`.

---

# Stream cancellation (AICHAT-15)

```sh
# stop contract, abort chain, logout stop, stopped flag (no Docker)
pnpm exec nx run-many -t test -p conversation-service auth-service mfe-chat test-utils
# the provider connection closes after Stop, real HTTP against the LLM mock (no Docker)
cd testing/mock-server && pnpm exec vitest run src/contract/abort.contract.spec.ts src/core/request-log.spec.ts
# browser: Stop, switching chat, closing the tab, logout (Docker)
pnpm mock:up
cd e2e && BASE_URL=http://localhost:8000 ANTHROPIC_API_KEY=mock-key-not-a-secret \
  pnpm exec playwright test --project=chromium src/tests/stream-cancellation.spec.ts src/tests/chat-mock.spec.ts
```

# Unit testing (AICHAT-17)

```sh
pnpm exec nx run-many -t test                    # every project, with coverage thresholds
pnpm exec nx run <project>:test                  # one project, e.g. mfe-chat, conversation-service
node scripts/unit-test/source-files.ts --check   # untested files vs the exempt list
```

# Component testing (AICHAT-18)

```sh
pnpm --filter @app/mfe-chat exec vitest run src/features/composer src/features/chat-view
pnpm --filter @app/mfe-settings exec vitest run src/features/api-keys/components/ProviderList.test.tsx
pnpm --filter @app/mfe-chat exec vitest run src/features -t accessibility   # a11y only
```

# End-to-end (Playwright) (Docker)

```sh
pnpm mock:up                             # or `docker compose up -d` for the real providers
pnpm --filter e2e run wait-for-stack     # polls shell + auth + conversation /health
pnpm e2e                                 # chromium, against http://localhost:8000 (BASE_URL to override)
E2E_OPENAI_API_KEY=sk-... pnpm e2e       # also runs "Test connection succeeds with a valid key" (AC-85)
```

JUnit XML lands in `e2e/test-results/e2e-results.xml` (`PLAYWRIGHT_JUNIT_OUTPUT_FILE` to override); the HTML report in `e2e/playwright-report`.

# Snapshot testing (AICHAT-20)

```sh
pnpm --dir services/conversation-service exec vitest run snapshot
pnpm --dir services/auth-service exec vitest run snapshot
pnpm --dir apps/mfe-chat exec vitest run src/shared/sse-drift.test.ts
pnpm --dir <project> exec vitest run -u   # update snapshots (local only)
```

# Performance / Lighthouse (AICHAT-21) (Docker)

```sh
export ACCESS_TOKEN_TTL_SECONDS=3600
pnpm mock:up
bash testing/lighthouse/run.sh          # 5 pages x 3 runs, median vs budgets
pnpm mock:down
```

# Bundle size budgets (AICHAT-22)

```sh
pnpm exec nx run-many -t build size                           # budgets of the four apps
node scripts/ci/bundle-size.ts snapshot --out /tmp/head.json  # sizes per file
```

# Integration testing (AICHAT-23)

```sh
pnpm --filter @app/conversation-service exec vitest run src/integration --reporter=verbose
pnpm --filter @app/auth-service exec vitest run src/integration --reporter=verbose
```

# Load testing (AICHAT-24) (Docker)

```sh
pnpm load:up
bash testing/k6/run.sh seed            # once
bash testing/k6/run.sh smoke
K6_PROM_RW=1 bash testing/k6/run.sh users_ramp
K6_PROM_RW=1 bash testing/k6/run.sh streams_ramp
pnpm mock:down
```

# Provider adapter replay (AICHAT-25)

```sh
cd services/conversation-service && npx vitest run src/test-utils src/features/llm-adapters/recorded-replay.spec.ts
node scripts/record-llm-fixtures.ts    # re-record fixtures (needs Ollama)
```

# Prompt injection (AICHAT-26) (Docker)

```sh
pnpm --filter @platform/promptfoo test                                 # harness unit tests
REDTEAM=1 bash scripts/mock-compose.sh up llm                          # stack with attack pages + canary
cd testing/promptfoo
REDTEAM_MODEL=claude-haiku-4-5@inject-obey   REDTEAM_GRADER=file://src/mock-grader.ts pnpm eval -o ../../redteam-results/obey.json
REDTEAM_MODEL=claude-haiku-4-5@inject-resist REDTEAM_GRADER=file://src/mock-grader.ts pnpm eval -o ../../redteam-results/resist.json
node src/report-cli.ts ../../redteam-results/obey.json
cd ../.. && pnpm mock:down
```

# SAST (AICHAT-27) (Docker)

```sh
pnpm sast
scripts/ci/semgrep.sh && node scripts/ci/sast-summary.ts semgrep-results/semgrep.sarif
```

# DAST / ZAP (AICHAT-28) (Docker)

```sh
ACCESS_TOKEN_TTL_SECONDS=3600 pnpm mock:up
AUTH=0 bash testing/zap/run.sh baseline                             # anonymous
bash testing/zap/run.sh baseline                                   # signed-in (the gate)
DAST_EMAIL=dast-api@dast.example.com bash testing/zap/run.sh api   # active API scan
pnpm mock:down
```

# Penetration testing (AICHAT-29) (Docker)

```sh
JWT_SECRET=change-me-in-every-environment docker compose -f compose.yaml up -d postgres auth-service conversation-service
node testing/pentest/run.ts --json /tmp/pentest.json
docker compose -f compose.yaml down
```

# SBOM generation (AICHAT-30) (Docker)

```sh
pnpm --filter e2e exec vitest run src/ci/sbom-workflow.spec.ts
# full image proof (builds 10 images, ~1h): see docs/AICHAT-30/WORKLOG.md §4
```

# Secret scanning (AICHAT-31)

```sh
gitleaks dir . --config .gitleaks.toml --redact                        # working tree
gitleaks git . --config .gitleaks.toml --redact --log-opts='--all -m'  # full history
sh scripts/ci/secret-scan-proof.sh                                     # a planted key must fail
```

# PII masking (AICHAT-32)

```sh
pnpm --filter @platform/pii-detector --filter @platform/test-utils exec vitest run
pnpm --filter @app/auth-service --filter @app/conversation-service exec vitest run src/integration
pnpm --filter @app/shell exec vitest run src/shared/observability
```

# GDPR retention and deletion (AICHAT-33) (Docker)

```sh
pnpm exec nx run-many -t test-db -p auth-service,conversation-service --parallel=1
```

# Coverage thresholds (AICHAT-34)

```sh
pnpm test                                                              # all projects + thresholds
cd packages/workspace-config && pnpm exec vitest run src/coverage-guard.test.ts
node scripts/ci/coverage-summary.ts
```

# Mock server (AICHAT-144) (Docker)

```sh
pnpm exec nx run-many -t lint typecheck test build -p mock-server --skip-nx-cache
cd testing/mock-server && pnpm exec vitest run src/contract
```

---

# Everything at once

```sh
pnpm exec nx affected -t lint typecheck test build size --base=$BASE   # unit/component/snapshot/coverage/size
pnpm sast                                                              # Docker
gitleaks git --redact --config .gitleaks.toml --log-opts=$BASE..HEAD
```
