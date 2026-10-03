---
title: "AICHAT-27 · [Foundations] SAST"
---

# AICHAT-27 · [Foundations] SAST

| Field | Value |
|---|---|
| Jira | [AICHAT-27](https://ipca-grupo11.atlassian.net/browse/AICHAT-27) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-31 (secret scanning), AICHAT-28 (DAST), AICHAT-29 (pentest) |
| Layer | Security, source code |

## 1. Goal

Run **static application security testing** on every PR; **high-severity findings block the merge**; findings that
already exist are fixed or waived with a reason.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** All TS/JS, Dockerfiles and GitHub Actions workflows confirmed in scope; generated code excluded
- [ ] **Tooling agreed:** Semgrep CE or CodeQL chosen (private-repo licence checked)
- [ ] Target environment available
- [ ] Tool chosen (CodeQL or Semgrep) → **recommendation in §3**

**DoD**
- [ ] Runs on every PR; high findings block the merge
- [ ] Existing findings fixed or waived
- [ ] Run instructions documented

## 3. Technologies and tool choice

| Option | Cost for this repo | Pros | Cons |
|---|---|---|---|
| **CodeQL** (`github/codeql-action`) | **Needs GitHub Advanced Security / Code Security** because `ipca-group11/ai-chat-platform` is **private** | Deep data-flow analysis for JS/TS, also scans GitHub Actions workflows; results in the Security tab | Paid on private repos; slower (~5–10 min) |
| **Semgrep CE** (`semgrep` CLI / `returntocorp/semgrep` image) | **Free** | Fast, rules for TS/React/Express/Node (`p/typescript`, `p/react`, `p/expressjs`, `p/nodejsscan`, `p/owasp-top-ten`, `p/github-actions`); custom rules in YAML; `--error --severity ERROR` fails the job | Cross-file data flow is limited in CE; SARIF upload to the Security tab also needs GHAS on private repos (so results go to the job log/artifact instead) |
| `eslint-plugin-security` | Free | Fits the existing ESLint setup | Noisy, pattern-only |

**Recommendation: Semgrep CE** in a GitHub Actions job (free on a private repo), SARIF kept as an artifact plus a
readable job summary. Switch to CodeQL if the org enables Code Security, or if the repo becomes public.

Severity mapping: Semgrep `ERROR` = "high" (blocks), `WARNING` = reported only.

## 4. Discovery: current state

- **No SAST tool configured** (no CodeQL, Semgrep, Dependabot or audit step). `ci.yml` runs only lint/typecheck/test/build.
- Languages: TypeScript/JavaScript only (≈408 `.ts`, 130 `.tsx`, 32 `.js`), plus 2 Prisma schemas, Dockerfiles, a shell script and GitHub Actions YAML.

### Manual pre-scan (what a SAST tool is expected to find or confirm)

| Area | Observation | Expected severity |
|---|---|---|
| `services/conversation-service/src/shared/env.ts:7` | `JWT_SECRET` **defaults to `"change-me-in-every-environment"`**. If the env var is missing, tokens signed with the default are accepted (auth-service requires the var, conversation-service doesn't) | **High** (hard-coded secret / insecure default) |
| `/metrics` in both services | Unauthenticated; conversation-service's is also reachable publicly as `/api/metrics` through the shell proxy | Medium (information disclosure) |
| `services/auth-service/src/main.ts` | Global rate limit 300 req / 15 min, **no `trust proxy`**, so behind Caddy + shell proxy all clients share one bucket | Medium |
| `conversation-service` | **No rate limiting** (incl. LLM sends) | Medium |
| Attachments `validators.ts` | MIME type comes from the client; no magic-byte check | Low/Medium |
| `eval`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML`, redirects | **None found** | — |
| `child_process` | Only in tests (`packages/ui/src/storybook-build.test.ts`, `packages/workspace-config/src/*.test.ts`) | Ignore (tests) |
| Path traversal in uploads | Not possible: stored filename is `randomUUID()+ext`, ext is allow-listed | — |
| Markdown | `react-markdown` without `rehype-raw` | — |
| GitHub Actions `deploy.yml` | `GITHUB_TOKEN` echoed into an SSH command string for `docker login` on the VM, and `${{ }}` expressions interpolated into `run:` scripts | Medium (should be checked by `p/github-actions` rules) |

## 5. Implementation plan (steps)

1. Confirm the tool (Semgrep CE unless Code Security is available).
2. Add `.semgrep.yml` (or use registry configs) with: `p/typescript`, `p/react`, `p/expressjs`, `p/nodejsscan`, `p/jwt`, `p/secrets`, `p/github-actions`, `p/dockerfile`; plus 2–3 **custom rules** for this codebase (e.g. "Express router without auth middleware", "`process.env.X ?? '<literal>'` for secrets").
3. Add `.semgrepignore` (generated Prisma client `src/generated/**`, `@mf-types`, `dist`, test files where appropriate).
4. **Baseline run** locally: `docker run --rm -v "$PWD:/src" semgrep/semgrep semgrep scan --config .semgrep.yml`. Triage every finding: fix, or waive with `// nosemgrep: <rule-id> -- <reason>` and log it in `docs/AICHAT-27/WAIVERS.md`.
5. CI job `sast` in a new `.github/workflows/security.yml` (on `pull_request` and `push: main`): run Semgrep with `--error --severity ERROR`, write SARIF, upload as an artifact, print a summary to `$GITHUB_STEP_SUMMARY`. For PRs, `--baseline-commit origin/main` reports only new findings.
6. Make `sast` a **required status check** on `main` (repo admin).
7. Document how to run locally, how to waive, and the severity policy.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-35](https://ipca-grupo11.atlassian.net/browse/AICHAT-35) | AICHAT-27-US1 | As a team, I want a SAST tool chosen with a documented reason so that the cost/coverage trade-off is clear | Decision recorded (Semgrep CE vs CodeQL, private-repo licensing) | 1 |
| [AICHAT-50](https://ipca-grupo11.atlassian.net/browse/AICHAT-50) | AICHAT-27-US2 | As a developer, I want a Semgrep configuration with rule packs and custom rules for our stack | `.semgrep.yml` + `.semgrepignore`; local run documented | 3 |
| [AICHAT-68](https://ipca-grupo11.atlassian.net/browse/AICHAT-68) | AICHAT-27-US3 | As a security owner, I want the existing findings triaged so that the gate starts green | All baseline findings fixed or waived in `WAIVERS.md` with reasons; JWT default secret ticketed as High | 3 |
| [AICHAT-86](https://ipca-grupo11.atlassian.net/browse/AICHAT-86) | AICHAT-27-US4 | As a team, I want SAST on every PR with high findings blocking the merge | `security.yml` job; ERROR findings fail; required check on `main` | 2 |
| [AICHAT-103](https://ipca-grupo11.atlassian.net/browse/AICHAT-103) | AICHAT-27-US5 | As a reviewer, I want SAST results readable in the PR | Job summary table + SARIF artifact | 1 |

## 7. Risks and open decisions

- Private-repo licensing (CodeQL/SARIF upload) → Semgrep CE with artifacts.
- False positives: start with ERROR-only blocking and review WARNINGs weekly.

## 8. Notes for the report

No static security analysis exists today. A manual pre-scan found **no classic injection sinks** (`eval`,
`innerHTML`, unsafe redirects, path traversal), which is a good sign. It did find an **insecure default JWT secret in
conversation-service** (High), unauthenticated `/metrics`, and missing or ineffective rate limiting. Because the
repository is private, CodeQL and the GitHub Security tab need a paid licence, so the recommended tool is **Semgrep CE** as a blocking PR job.
