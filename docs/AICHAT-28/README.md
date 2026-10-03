---
title: "AICHAT-28 · [Foundations] DAST"
---

# AICHAT-28 · [Foundations] DAST

| Field | Value |
|---|---|
| Jira | [AICHAT-28](https://ipca-grupo11.atlassian.net/browse/AICHAT-28) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-27 (SAST), AICHAT-29 (pentest), unassigned "Security header / TLS testing" |
| Layer | Security, running application |

## 1. Goal

Scan the **running stack** for OWASP Top 10 issues (headers, cookies, information disclosure, …) with the
**OWASP ZAP baseline** scan. **High alerts fail** the job; known false positives are listed in a **rules file**.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** Local compose stack in CI confirmed as the target (shell + APIs); production excluded unless approved; passive vs active scan decided
- [ ] **Tooling agreed:** ZAP baseline (`zaproxy/action-baseline`), `rules.tsv` and AJAX spider confirmed
- [ ] Target environment available
- [x] A running stack reachable from CI → **yes: `e2e.yml` already starts `compose.yaml` on the runner**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge or deploy
- [ ] Run instructions documented
- [ ] ZAP baseline runs against the stack
- [ ] High alerts fail
- [ ] False positives listed in a rules file

## 3. Technologies

| Tool | Role |
|---|---|
| **OWASP ZAP** (`zaproxy/zap-stable` Docker image, now "ZAP by Checkmarx") | Spider + passive scan (`zap-baseline.py`); optional active scan of the API (`zap-api-scan.py`) |
| `zaproxy/action-baseline` GitHub Action | Runs the baseline and uploads the HTML/MD report |
| `rules.tsv` (ZAP `-c` config file) | Per-rule `IGNORE` / `WARN` / `FAIL`, which is the "rules file" in the DoD |
| ZAP authentication (context file or `--hook` script / `-z` options with a cookie) | Scan logged-in pages (`/chats`, `/settings`) and APIs, not only the login page |
| OpenAPI spec (from AICHAT-12, if it exists) | Lets `zap-api-scan.py` hit every REST route |
| GitHub Actions | Job after the stack is healthy |

## 4. Discovery: current state

- **No DAST** in the repo.
- **CI stack:** `.github/workflows/e2e.yml` runs `docker compose up -d --build` (resolves to `compose.yaml`) and `wait-for-stack`. Reachable on the runner: shell `http://localhost:8000`, auth `:4001`, conversation `:4002`, remotes `:3001-3003`, Grafana `:3300`, Prometheus `:9090`, Faro collector `:12347`.
- Two compose files exist: `compose.yaml` (hardened: `127.0.0.1` binds, Loki/Alloy) and an older `docker-compose.yml` (all interfaces, Postgres published on 5432, Grafana `admin` default, `:latest` images). **The DAST target must be `compose.yaml`**, and the old file should be flagged as risky / removed.
- **Production** (`deploy/azure`): Caddy publishes 80/443 and 3001-3003; `/grafana` is public; `/collect` → Alloy.

### Expected baseline findings (from reading the config)

| Expected ZAP alert | Where | Notes |
|---|---|---|
| CSP header not set (10038) | Shell + remotes (HTML from `vite preview`) and Caddy | `helmet()` only covers API responses; Caddyfile sets **no HSTS, CSP, X-Frame-Options**, … |
| Missing anti-clickjacking header (10020) | Shell/remotes | Same cause |
| Strict-Transport-Security not set (10035) | Production only (HTTPS) | Caddyfile |
| X-Content-Type-Options missing (10021) | Shell/remotes | Same |
| Cookie without Secure flag (10011) | Local CI only (`COOKIE_SECURE=false` in `compose.yaml`) | **False positive locally**, so add it to the rules file with a reason; in production `Secure` is on |
| Server leaks version / `X-Powered-By` | `vite preview` | Check |
| CORS misconfiguration | Services use an allow-list with `credentials: true`; Caddy sets `Access-Control-Allow-Origin: https://$DOMAIN` on remotes | Likely OK |
| Information disclosure | `/api/metrics` public through the shell proxy | Custom check (ZAP may not flag it) |

## 5. Implementation plan (steps)

1. Choose the scope: **baseline (passive) on every PR** in CI against the local stack; optional **full/API scan weekly**; one manual baseline against production with the team's agreement.
2. Create `testing/zap/rules.tsv` with the defaults: High → `FAIL`, Medium → `WARN`, Low/Info → `IGNORE`; add documented false positives (e.g. 10011 locally).
3. Authentication: a hook or replacer rule that sends the `access_token` cookie of a seeded test user (reuse `e2e` test-user seeding), so authenticated pages and `/api/*` are spidered too. Seed a few chats so the spider finds `/chats/:id`.
4. CI job `dast` (in `e2e.yml` after `wait-for-stack`, or in a separate `security.yml` reusing the steps): `zaproxy/action-baseline` with `target: http://localhost:8000`, `rules_file_name: testing/zap/rules.tsv`, `cmd_options: -a -j` (AJAX spider for the React SPA). Also scan the APIs directly (`:4001`, `:4002`). Reports uploaded as artifacts. `fail_action: true`.
5. Triage the first run; fix or ticket the header findings (Caddyfile `header` block: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy). The fixes belong to the deploy owner.
6. Required check on `main` (repo admin).
7. Document: run locally (`docker run -t zaproxy/zap-stable zap-baseline.py -t http://host.docker.internal:8000 -c rules.tsv -r report.html`), and how to add a false positive.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-52](https://ipca-grupo11.atlassian.net/browse/AICHAT-52) | AICHAT-28-US1 | As a security tester, I want a ZAP rules file with severity policy and documented false positives | `testing/zap/rules.tsv` with reasons for each IGNORE | 1 |
| [AICHAT-71](https://ipca-grupo11.atlassian.net/browse/AICHAT-71) | AICHAT-28-US2 | As a security tester, I want ZAP to scan authenticated pages and APIs so that the scan isn't limited to the login screen | Seeded user + cookie injection; report shows `/chats`, `/settings`, `/api/chats` URLs | 3 |
| [AICHAT-90](https://ipca-grupo11.atlassian.net/browse/AICHAT-90) | AICHAT-28-US3 | As a team, I want the ZAP baseline in CI with high alerts failing the job | CI job with `fail_action`; reports as artifacts; required check | 2 |
| [AICHAT-106](https://ipca-grupo11.atlassian.net/browse/AICHAT-106) | AICHAT-28-US4 | As an operator, I want the missing security headers found and ticketed | First-run triage; Caddyfile header fixes ticketed to the deploy owner | 2 |
| [AICHAT-121](https://ipca-grupo11.atlassian.net/browse/AICHAT-121) | AICHAT-28-US5 | (Optional) As a security tester, I want a weekly API scan using the OpenAPI spec | `zap-api-scan.py` weekly job (depends on AICHAT-12 spec) | 3 |

## 7. Risks and open decisions

- Active scans can create data and be slow; keep active scanning weekly and **never against production without approval**.
- SPA crawling needs the AJAX spider, since the classic spider sees almost nothing in a React app.
- The legacy `docker-compose.yml` exposes Postgres and Grafana on all interfaces with default passwords. Recommend removing it.

## 8. Notes for the report

There is no dynamic scanning today, but the CI already brings up the full stack (for E2E), so DAST can reuse it at
little cost. Reading the configuration predicts the first findings: **no browser security headers on the frontends**
(no CSP, HSTS or X-Frame-Options: `helmet` only covers the APIs and Caddy adds none), a publicly reachable
`/api/metrics`, and a legacy compose file that publishes Postgres. ZAP baseline with an authenticated AJAX spider and a
`rules.tsv` policy file covers the DoD.
