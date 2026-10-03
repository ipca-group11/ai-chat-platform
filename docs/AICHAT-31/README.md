---
title: "AICHAT-31 · [Foundations] Secret scanning"
---

# AICHAT-31 · [Foundations] Secret scanning

| Field | Value |
|---|---|
| Jira | [AICHAT-31](https://ipca-grupo11.atlassian.net/browse/AICHAT-31) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-27 (SAST: Semgrep `p/secrets` overlaps) |
| Layer | Security, repository |

## 1. Goal

No keys, passwords or tokens are committed. **gitleaks on every PR**, a **one-time scan of the full git history**,
**GitHub secret scanning** turned on, and **any leaked secret rotated**.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** PR diffs, the full git history (once) and the working tree confirmed in scope
- [ ] **Tooling agreed:** gitleaks CLI/Docker or action (licence) chosen; GitHub secret scanning availability checked
- [ ] Target environment available
- [ ] gitleaks config with allow-list for test fixtures → **fixtures listed in §4.2**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] gitleaks on every PR
- [ ] Full git history scanned once
- [ ] GitHub secret scanning on
- [ ] Any leaked secret rotated

## 3. Technologies

| Tool | Role | Notes |
|---|---|---|
| **gitleaks** (CLI, MIT) | Regex + entropy secret detection; `git` mode (history) and `dir` mode; `.gitleaks.toml` with allow-lists | Free |
| `gitleaks/gitleaks-action@v2` | GitHub Action wrapper | **Needs a free `GITLEAKS_LICENSE` key for organisation repos** (`ipca-group11` is an org). Alternative: run the CLI binary or Docker image directly (no licence needed) |
| **GitHub secret scanning + push protection** | Provider-verified detection (Anthropic, OpenAI, Azure, GitHub tokens…) | **Private repo → needs GitHub Secret Protection (paid)**. Public repos get it free. Partner alerts for some tokens still apply |
| **pre-commit hook** (optional: `pre-commit` or `lefthook`/`husky`) | Catch secrets before they're committed | Developer machines |
| TruffleHog OSS (alternative) | Verifies found keys against provider APIs | Second opinion for the history scan |

## 4. Discovery: current state

### 4.1 Configuration
- **No gitleaks, TruffleHog or pre-commit config.** No secret scanning step in any workflow.
- Repository `ipca-group11/ai-chat-platform` is **private**; the API reports no `security_and_analysis` settings, so **GitHub secret scanning is not enabled / not available** without a paid add-on.
- `.env.credentials` exists locally and is **git-ignored** (the uncommitted `.gitignore` change adds it). It was **not read** during discovery. Check it was never committed (history scan).
- `docs/CREDENTIALS.md` and `docs/ACCESS.md` are new untracked docs. **Review them before committing**; they must not contain real secrets.

### 4.2 Expected findings that are not real secrets (allow-list candidates)

| File | Lines | Kind |
|---|---|---|
| `e2e/src/tests/configuration.spec.ts` | 25, 27, 29, 47, 73, 107 | Fake provider API keys |
| `packages/shared-types/src/api-keys/storage.test.ts` | 67, 167 | Fake keys |
| `packages/shared-types/src/api-keys/schema.test.ts` | 64 | Fake key |
| `apps/mfe-settings/src/features/api-keys/hooks/useApiKeys.test.tsx` | 44, 108, 118 | Fake keys |
| `apps/mfe-chat/src/features/chat-view/components/ChatView.test.tsx` | 226 | Fake key |
| `services/*/src/**/env.spec.ts`, `services/conversation-service/src/app.spec.ts:9` | — | Test JWT secrets |

### 4.3 Committed development defaults (not leaks, but to review)

| File | Value kind |
|---|---|
| `.env.example:19,32` | Postgres password, `JWT_SECRET` placeholders |
| `compose.yaml` (Postgres, JWT defaults) | `llmchat_local_dev`, `local-dev-only-change-me` |
| `docker-compose.yml` | Grafana admin `admin`, Postgres default |
| `scripts/dev.sh:19`, `services/*/.env.example` | Dev defaults |
| `services/conversation-service/src/shared/env.ts:7` | `JWT_SECRET` code default (also a SAST High, see AICHAT-27) |

Production (`deploy/azure/docker-compose.yml`) uses `${JWT_SECRET:?}`, `${GRAFANA_ADMIN_PASSWORD:?}`, so it fails without real values. Good.
**Check:** the production secrets must not equal any committed default.

No real-looking keys (`sk-ant-…`, `sk-…`, `ghp_…`, AWS, PEM, JWTs) were found in tracked files by pattern search. The **history** has not been scanned yet.

## 5. Implementation plan (steps)

1. `.gitleaks.toml`: `[extend] useDefault = true`; `[allowlist]` with `paths` for test files (`.*\.(spec|test)\.tsx?$` limited to the files above) and `regexes` for the obvious fake patterns (e.g. `sk-ant-test`, `local-dev-only-change-me`). Prefer **narrow** allow-lists (per file + per pattern) over broad ones.
2. **History scan, once:** `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest git /repo --report-format json --report-path gitleaks-history.json`; triage; keep a redacted summary in `docs/AICHAT-31/HISTORY-SCAN.md`. If a real secret is found: **rotate it first** (Anthropic/OpenAI key, JWT secret → forces re-login, Postgres password, Grafana admin, Azure/SSH keys, GHCR tokens), then decide whether to rewrite history (`git filter-repo`); rotation is mandatory, rewriting is optional.
3. CI job `secrets` (in `security.yml` with AICHAT-27): `gitleaks git --log-opts="origin/main..HEAD"` on PRs (only new commits) and full `dir` mode on `main`; exit code fails the job; SARIF/JSON artifact.
4. Get a free `GITLEAKS_LICENSE` if using the action, or use the Docker image (no licence).
5. GitHub secret scanning: ask the org admin whether Secret Protection is available; if not, record the decision ("compensated by gitleaks in CI + pre-commit").
6. Optional pre-commit hook (`gitleaks protect --staged`) documented for developers.
7. Required check on `main`.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-44](https://ipca-grupo11.atlassian.net/browse/AICHAT-44) | AICHAT-31-US1 | As a developer, I want a gitleaks config with a narrow allow-list for test fixtures so that CI doesn't flag fake keys | `.gitleaks.toml`; scan of current tree is clean; each allow-list entry has a comment | 2 |
| [AICHAT-55](https://ipca-grupo11.atlassian.net/browse/AICHAT-55) | AICHAT-31-US2 | As a security owner, I want the full git history scanned once so that past leaks are known | History report triaged; summary doc without secret values | 2 |
| [AICHAT-73](https://ipca-grupo11.atlassian.net/browse/AICHAT-73) | AICHAT-31-US3 | As a security owner, I want every leaked secret rotated | Rotation checklist done for each real finding (or "none found" recorded) | 2 |
| [AICHAT-91](https://ipca-grupo11.atlassian.net/browse/AICHAT-91) | AICHAT-31-US4 | As a team, I want gitleaks on every PR blocking merges with secrets | CI job; a test commit with a fake-but-valid-looking key fails | 2 |
| [AICHAT-109](https://ipca-grupo11.atlassian.net/browse/AICHAT-109) | AICHAT-31-US5 | As a team, I want GitHub secret scanning on, or a recorded decision why not | Enabled (if licensed) or decision documented | 1 |
| [AICHAT-124](https://ipca-grupo11.atlassian.net/browse/AICHAT-124) | AICHAT-31-US6 | (Optional) As a developer, I want a pre-commit hook that blocks secrets locally | Hook documented; works on macOS/Linux | 1 |

## 7. Risks and open decisions

- **Licensing:** org repo → gitleaks-action licence (free key) or CLI; GitHub secret scanning paid on private repos.
- Rewriting history breaks every clone and open PR; only do it if a secret can't be rotated.
- The untracked `docs/CREDENTIALS.md` / `docs/ACCESS.md` must be checked before they are committed.

## 8. Notes for the report

There is no secret scanning today, and the private-repo setup means GitHub's native scanning is not available without a paid
add-on. A pattern search of the current tree found **no real secrets**, only fake test keys and dev defaults, so an
allow-list is needed so the scanner isn't noisy. The **git history has not been checked**, and a real `.env.credentials` exists
locally, so the one-time history scan is the most valuable step. Plan: gitleaks (CLI) on every PR + one history scan +
rotation of anything found.
