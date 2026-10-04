# SAST waivers (AICHAT-27)

Every baseline finding was either fixed or listed here with a reason. Baseline: 24 ERROR, 34 WARNING, 13 INFO (evidence `01-baseline-scan`). After triage: 0 ERROR; the WARNING and INFO items below stay visible in the job summary.

## ERROR findings

| ID | Rule | Where | Count | Decision | Reason |
|---|---|---|---|---|---|
| W1 | `njsscan ... node_secret`, `node_password`, `node_api_key`, `aichat.secret-env-fallback-literal` | `*.spec.ts(x)`, `*.test.*`, `e2e/src/fixtures/`, `services/*/src/shared/test/` | 16 ERROR (+ 11 WARNING) | Waived by path ignore in `.semgrepignore` | Fake passwords and keys used only by tests. Test code is never built into an image. We accept losing the other rules on test files. |
| W2 | `njsscan ... node_api_key` | `LLM_API_KEY_HEADER` in `apps/mfe-chat/src/shared/types.ts`, `packages/shared-types/src/api-keys/schema.ts`, `packages/shared-types/src/chat/provider.ts`, `services/conversation-service/src/shared/contracts/http.ts` | 4 | Waived with `nosemgrep` (reason in the comment) | False positive: the string is the HTTP header name `X-Llm-Api-Key`, not a key. |
| W3 | `detected-bcrypt-hash` | `services/auth-service/src/features/session/model.ts` | 1 | **Resolved** ([AICHAT-252](https://ipca-grupo11.atlassian.net/browse/AICHAT-252)) | Was a dummy hash literal compared when the email is unknown, so unknown-email and wrong-password take the same time. It is now generated on first use at the same cost as real hashes (`shared/password.ts`), so there is no literal and no `nosemgrep` any more. |
| W4 | `dockerfile ... missing-user` | `observability/alloy.Dockerfile`, `observability/loki.Dockerfile` | 2 | Waived with `nosemgrep` | Observability images from Grafana. Adding `USER` could break write access to the named volumes. We will test a non-root user in a separate change. |
| W5 | `aichat.secret-with-literal-default-zod` (**F1**) | `services/conversation-service/src/shared/env.ts` (`JWT_SECRET`) | 1 | **Resolved** in [AICHAT-210](https://ipca-grupo11.atlassian.net/browse/AICHAT-210) | **Severity High.** Was: if `JWT_SECRET` was missing, conversation-service started with a public value and accepted tokens signed with it. Fixed: `JWT_SECRET` is now required with no default in both services, in every `NODE_ENV`, so a service without it fails at boot ("JWT_SECRET is required"). The `nosemgrep` line is removed, so the rule guards against the default coming back. Compose and `scripts/dev.sh` still pass a local-only value; `deploy/azure` requires a real one (`${JWT_SECRET:?}`). |
| W10 | `njsscan ... node_api_key` | `scripts/record-llm-fixtures.ts` (AICHAT-25) | 2 | Waived with `nosemgrep` (reason in the comment) | False positive: `"ollama"` is the placeholder key a local Ollama server ignores; real keys only come from the environment. |
| W11 | `njsscan ... node_password`, `node_api_key` | `testing/mock-server/src/data/factories.ts` (`MOCK_PASSWORD`), `testing/mock-server/src/routers/conversation.router.ts` (header name) (AICHAT-144) | 2 | Waived with `nosemgrep` (reason in the comment) | False positives: the password of the seeded mock users is test data, and `x-llm-api-key` is the header name (as in W2). |

## WARNING and INFO findings (reported, not blocking, accepted)

| ID | Rule | Count | Reason |
|---|---|---|---|
| W6 | `github-actions-mutable-action-tag` | 16 (14 at baseline, +2 for the new job) | Actions are pinned to major tags (`actions/checkout@v4`). Pinning to commit SHAs is a supply-chain hardening for a later change. |
| W7 | `node_insecure_random_generator` | 5 | `Math.random()` only builds correlation and temporary client ids. They are not secrets. |
| W8 | `npm-missing-minimum-release-age`, `pnpm-block-exotic-sub-dependencies`, `pnpm-missing-minimum-release-age`, `pnpm-trust-policy` | 4 | Package manager hardening options. They belong to the dependency epic (SBOM / audit), not to code scanning. |
| W9 | `good_helmet_checks.*` | 13 | INFO only: the rule confirms that helmet headers are set. Nothing to fix. |
