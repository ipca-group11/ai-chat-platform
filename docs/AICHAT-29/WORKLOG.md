---
title: "AICHAT-29 · Penetration testing: work log"
---

# AICHAT-29 · Penetration testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-29](https://ipca-grupo11.atlassian.net/browse/AICHAT-29) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-29-penetration-testing` |
| Started / finished | 2026-10-04 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-04

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | In/out-of-scope targets (README §5)? | In: the shell, the three remotes, `/auth/*`, `/api/*`, `/grafana`, `/collect` and the source code (grey-box), hypotheses H1–H11. Out: the Azure control plane and subscription, other tenants, the Anthropic/OpenAI APIs, social engineering, physical attacks, volumetric DoS | Team (owner delegated) |
| Tooling agreed | Met | Burp/ZAP, jwt_tool, ffuf, testssl.sh; checklist; CVSS? | OWASP ZAP (the image AICHAT-28 already uses), curl and small TypeScript attack scripts in `testing/pentest/` (they replace jwt_tool and ffuf and are repeatable). testssl.sh is not run: the local staging copy has no public TLS, and we do not hammer production. Checklist: OWASP WSTG 4.2 with ASVS 4.0 level 1 references. Severity: CVSS v3.1 base score | Team (owner delegated) |
| Target environment available | Met | Staging or production? | Production is one shared 4 GB VM, so every active test runs against a **local staging copy**: the production compose files on Docker, with seeded test accounts (two users plus an invited, not yet registered email for H1). We do not create a cloud VM. Production gets only a few read-only GET requests (response headers, whether `/api/metrics` and `/grafana` answer), the same as a browser visit | Team (owner delegated) |
| Time box, scope and rules of engagement written | Met | README §5 draft | Approved as drafted, with the staging decision above. Time box: one testing session plus the report on the same day. Stop conditions: degradation of a shared service, any real user data, a critical finding (stop and record it first). Evidence is redacted; no credentials in the report. Supervisor approval is not needed because no cloud resource is attacked | Team (owner delegated) |
| High findings | Met | Fix or ticket? | A High finding in our own code with a small, testable fix is fixed in this epic and retested; anything larger is a Jira task linked to the epic, with the retest result in the report | Team (owner delegated) |

Blockers: none.

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| <tool for this epic> | … | … |

## 3. Steps

### US1 · <story summary> ([AICHAT-<key>](https://ipca-grupo11.atlassian.net/browse/AICHAT-<key>))

**What and why.** …

**Files.**
- `path/to/file` (new): …

**How to run.**

```sh
<one command from the repo root>
```

**How to repeat it manually.**

1. …
2. …
3. Expected output: …

**Result.** …

![<caption>](evidence/01-<what>.png)

**Problems and fixes.** …

### US2 · …

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
