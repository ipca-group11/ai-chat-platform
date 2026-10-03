---
title: "AICHAT-29 · [Foundations] Penetration testing"
---

# AICHAT-29 · [Foundations] Penetration testing

| Field | Value |
|---|---|
| Jira | [AICHAT-29](https://ipca-grupo11.atlassian.net/browse/AICHAT-29) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Run mode | **Manual, time-boxed activity** (not a CI test) |
| Related | AICHAT-26, 27, 28 (automated security tests feed the pentest), unassigned "Authorization / IDOR testing" |

## 1. Goal

A **manual, time-boxed attack** of the deployed app within written **rules of engagement**, producing a **report
with findings and severities** in `docs/`. High findings are fixed or ticketed.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** In/out-of-scope targets per §5 confirmed
- [ ] **Tooling agreed:** Burp/ZAP, jwt_tool, ffuf and testssl.sh confirmed; WSTG/ASVS checklist and CVSS version chosen
- [ ] Target environment available
- [ ] Time box, scope and rules of engagement written → **draft in §5**

**DoD**
- [ ] Run instructions / methodology documented
- [ ] Report with findings and severity in `docs/`
- [ ] High findings fixed or ticketed

## 3. Technologies and methodology

| Tool / standard | Role |
|---|---|
| **OWASP WSTG** (Web Security Testing Guide) and **OWASP ASVS 4.0 L1/L2** | Test checklist and pass criteria |
| **OWASP Top 10 for LLM Applications (2025)** | LLM-specific checks (prompt injection, excessive agency, sensitive info disclosure) |
| **Burp Suite Community** or **OWASP ZAP** (manual mode) | Intercepting proxy, repeater, intruder |
| `jwt_tool` | JWT attacks (`alg:none`, weak secret, key confusion) |
| `ffuf` | Content/route discovery |
| `curl`, browser DevTools | Header, cookie and CORS checks |
| `testssl.sh` | TLS configuration of the Caddy endpoint |
| **CVSS v3.1** (or v4.0) calculator | Severity scoring in the report |

## 4. Discovery: attack surface and hypotheses to test

| # | Area | Hypothesis from code review | Where |
|---|---|---|---|
| H1 | **Chat sharing by email** | Membership is matched by the **email claim** and registration has **no email verification**, so anyone can register an invited (not yet registered) email and get into the chat | `chats/service.ts:113-127` (`getAccessible`), auth-service register |
| H2 | **JWT** | conversation-service falls back to `JWT_SECRET="change-me-in-every-environment"` if the env is missing; HS256 with a shared secret; also accepts `Authorization: Bearer` | `conversation-service/src/shared/env.ts:7`, `auth-middleware.ts` |
| H3 | **Refresh token reuse** | Reuse is rejected, but the **token family is not revoked** on reuse detection (a stolen token keeps working for the attacker if used first) | `auth-service/src/features/session/model.ts` |
| H4 | **Rate limiting** | auth-service: one global 300/15 min bucket and **no `trust proxy`** (all clients share it behind Caddy, so it's an easy DoS of login); conversation-service: **none**, so LLM spend can be abused with a stolen session | `auth-service/src/main.ts:37-44` |
| H5 | **IDOR** | Owner/member checks exist (`getOwned`, `getAccessible`, author checks); **any member can retry any failed assistant message** (by design?) | `chats/service.ts`, `messages/service.ts`, `attachments/service.ts` |
| H6 | **Uploads** | Client-supplied MIME trusted (no magic bytes); `pdf-parse` on untrusted PDFs; 20 MB multer cap in memory, so memory pressure on the 4 GB VM | `attachments/validators.ts`, `text-extractor.ts` |
| H7 | **Public endpoints** | `/api/metrics` public through the shell proxy; Grafana public at `/grafana`; Faro `/collect` accepts anything (log injection / storage abuse) | `deploy/azure/Caddyfile`, `apps/shell/vite.config.ts` |
| H8 | **Browser security** | No CSP/HSTS/X-Frame-Options on the frontends; the provider API key is kept in `sessionStorage`, so **any XSS steals the user's LLM key** | Caddyfile, `packages/shared-types/src/api-keys/storage.ts` |
| H9 | **LLM** | Web fetch without domain allow-list (exfiltration through fetches); no system prompt | see AICHAT-26 |
| H10 | **Remotes on separate ports** (3001-3003) | Remote JS served from other origins; check CORS and whether `remoteEntry.js` can be replaced or cached by an attacker | Caddyfile |
| H11 | **Secrets** | Dev defaults committed (`.env.example`, compose); check that production does not use them | AICHAT-31 |

## 5. Rules of engagement (draft, DoR)

- **Scope (in):** `https://$DOMAIN` (shell), `:3001-3003` (remotes), `/auth/*`, `/api/*`, `/grafana`, `/collect`; the source code (grey-box).
- **Scope (out):** the Azure control plane and subscription, other tenants, Anthropic/OpenAI APIs (no attacks against providers), social engineering, physical attacks, volumetric DoS.
- **Accounts:** testers use only their own test accounts (2+ users to test IDOR); no real user data.
- **Time box:** 2 days of testing + 1 day of reporting (to agree).
- **Window:** agreed date/time; team informed; snapshot / DB backup before starting.
- **Stop conditions:** service degradation, access to real user data, or a critical finding (report immediately to the team).
- **Data handling:** evidence stored in the repo only after redaction; credentials never in the report.
- **Approval:** signed off by the team (and course supervisor if required), since the VM is shared.

Recommendation: run first against a **staging copy** (same compose on a temporary VM) and only the read-only checks against production.

## 6. Implementation plan (steps)

1. Write and approve the RoE (§5) in `docs/AICHAT-29/RULES-OF-ENGAGEMENT.md`.
2. Prepare: staging VM or window, two test accounts, Burp/ZAP, the WSTG/ASVS checklist subset.
3. Run the automated pre-steps (ZAP baseline from AICHAT-28, Semgrep from AICHAT-27) to avoid duplicate manual work.
4. Test hypotheses H1–H11 plus the WSTG categories: identity/authentication, authorisation, session management, input validation, error handling, business logic, client-side, API.
5. Score findings with CVSS; write `docs/AICHAT-29/REPORT.md` (executive summary, scope, method, findings with severity/evidence/fix, retest status).
6. Create Jira tickets for High/Critical findings (linked to this epic); retest after the fixes.

## 7. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-38](https://ipca-grupo11.atlassian.net/browse/AICHAT-38) | AICHAT-29-US1 | As the team, we want written rules of engagement so that the pentest is safe and authorised | RoE with scope, time box, accounts, stop conditions; approved | 1 |
| [AICHAT-49](https://ipca-grupo11.atlassian.net/browse/AICHAT-49) | AICHAT-29-US2 | As a tester, I want a staging environment identical to production so that attacks don't hit real users | Temporary VM with the same compose, seeded test data | 2 |
| [AICHAT-67](https://ipca-grupo11.atlassian.net/browse/AICHAT-67) | AICHAT-29-US3 | As a tester, I want to check authentication and authorisation (H1–H5) so that account and chat takeover risks are known | Each hypothesis confirmed or refuted with evidence | 5 |
| [AICHAT-85](https://ipca-grupo11.atlassian.net/browse/AICHAT-85) | AICHAT-29-US4 | As a tester, I want to check uploads, public endpoints, browser security and LLM risks (H6–H11) | Each hypothesis confirmed or refuted with evidence | 5 |
| [AICHAT-104](https://ipca-grupo11.atlassian.net/browse/AICHAT-104) | AICHAT-29-US5 | As a stakeholder, I want a pentest report with CVSS severities | `REPORT.md` in `docs/AICHAT-29/` | 3 |
| [AICHAT-122](https://ipca-grupo11.atlassian.net/browse/AICHAT-122) | AICHAT-29-US6 | As the team, we want High findings fixed or ticketed and retested | Tickets linked to the epic; retest results in the report | 2 |

## 8. Risks and open decisions

- Production is a single shared 4 GB VM, so testing can degrade it. Prefer staging.
- Academic context: confirm if the course requires supervisor approval for attacking a cloud resource (Azure's policy allows testing your own resources without prior notice, within the rules of engagement).

## 9. Notes for the report

The code review for this discovery already produced **11 concrete hypotheses**. The most important: **chat
access granted by unverified email** (H1), a **default JWT secret fallback** (H2), **no refresh-token family
revocation** (H3), **ineffective or missing rate limits** (H4), and **the user's LLM API key in sessionStorage** with no CSP (H8). The
pentest is a manual, time-boxed activity with written rules of engagement, OWASP WSTG/ASVS as the method and CVSS for severity.
