# SAST waivers (AICHAT-27)

Every baseline finding was either fixed or listed here with a reason. Baseline: 24 ERROR, 34 WARNING, 13 INFO (evidence `01-baseline-scan`). After triage: 0 ERROR; the WARNING and INFO items below stay visible in the job summary.

## ERROR findings

| ID | Rule | Where | Count | Decision | Reason |
|---|---|---|---|---|---|
| W1 | `njsscan ... node_secret`, `node_password`, `node_api_key`, `aichat.secret-env-fallback-literal` | `*.spec.ts(x)`, `*.test.*`, `e2e/src/fixtures/`, `services/*/src/shared/test/` | 16 ERROR (+ 11 WARNING) | Waived by path ignore in `.semgrepignore` | Fake passwords and keys used only by tests. Test code is never built into an image. We accept losing the other rules on test files. |
| W2 | `njsscan ... node_api_key` | `LLM_API_KEY_HEADER` in `apps/mfe-chat/src/shared/types.ts`, `packages/shared-types/src/api-keys/schema.ts`, `packages/shared-types/src/chat/provider.ts`, `services/conversation-service/src/shared/contracts/http.ts` | 4 | Waived with `nosemgrep` (reason in the comment) | False positive: the string is the HTTP header name `X-Llm-Api-Key`, not a key. |
| W3 | `detected-bcrypt-hash` | `services/auth-service/src/features/session/model.ts` | 1 | Waived with `nosemgrep` | Dummy hash compared when the email is unknown, so unknown-email and wrong-password take the same time. It protects nothing. |
| W4 | `dockerfile ... missing-user` | `observability/alloy.Dockerfile`, `observability/loki.Dockerfile` | 2 | Waived with `nosemgrep` | Observability images from Grafana. Adding `USER` could break write access to the named volumes. We will test a non-root user in a separate change. |
| W5 | `aichat.secret-with-literal-default-zod` (**F1**) | `services/conversation-service/src/shared/env.ts` (`JWT_SECRET`) | 1 | Waived with `nosemgrep`, **not fixed here** | **Severity High.** If `JWT_SECRET` is missing, conversation-service starts with a public value and accepts tokens signed with it. Owner decision: ticketed as [AICHAT-210](https://ipca-grupo11.atlassian.net/browse/AICHAT-210) and fixed there (make the variable required, as auth-service does). Remove the `nosemgrep` line when that ticket is done. |

## WARNING and INFO findings (reported, not blocking, accepted)

| ID | Rule | Count | Reason |
|---|---|---|---|
| W6 | `github-actions-mutable-action-tag` | 15 (14 at baseline, +1 for the new job) | Actions are pinned to major tags (`actions/checkout@v4`). Pinning to commit SHAs is a supply-chain hardening for a later change. |
| W7 | `node_insecure_random_generator` | 5 | `Math.random()` only builds correlation and temporary client ids. They are not secrets. |
| W8 | `npm-missing-minimum-release-age`, `pnpm-block-exotic-sub-dependencies`, `pnpm-missing-minimum-release-age`, `pnpm-trust-policy` | 4 | Package manager hardening options. They belong to the dependency epic (SBOM / audit), not to code scanning. |
| W9 | `good_helmet_checks.*` | 13 | INFO only: the rule confirms that helmet headers are set. Nothing to fix. |
