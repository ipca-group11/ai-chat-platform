---
title: "AICHAT-29 · Penetration testing: rules of engagement"
---

# Rules of engagement

A security assessment of our own AI chat platform, run by the team as part of the course work.
Approved by the team on 2026-10-04 (owner delegated). It follows the OWASP Web Security Testing
Guide (WSTG 4.2) with ASVS 4.0 level 1 references, and scores findings with CVSS v3.1.

## Purpose

Confirm or refute the weaknesses that the code review recorded as hypotheses H1–H11
(`README.md` §4), on a running copy of the platform, and write them up with a severity and a fix
or a ticket. This is a grey-box assessment: the testers have the source code.

## Scope

**In scope** (our own systems only):

- The shell app and the three remote apps.
- The gateway routes `/auth/*`, `/api/*`, `/grafana` and `/collect`.
- The source code (grey-box reading).
- Hypotheses H1–H11.

**Out of scope** (never touched):

- The Azure control plane, the subscription and any other tenant.
- The Anthropic and OpenAI APIs — no requests are aimed at the model providers.
- Social engineering and physical access.
- Volumetric denial of service. Rate-limit checks send only the few requests needed to observe
  the limit, never a flood.

## Target environment

Every active check runs against a **local staging copy**: the production compose files brought up
on Docker on the tester's machine, seeded with test accounts only. No cloud resource is created or
attacked, so no supervisor sign-off is needed.

Production receives **only a handful of read-only GET requests** — the response headers and whether
`/api/metrics` and `/grafana` answer — which is the same traffic an ordinary browser visit makes.

## Accounts and data

- Two seeded test users, plus one invited-but-unregistered email address to check the chat-sharing
  path (H1). No real user accounts or data are used.
- Evidence is stored in the repository only after redaction. Tokens, cookies and secrets are
  masked; no credential appears in the report or the evidence.

## Time box

One testing session, with the report written the same day.

## Stop conditions

Stop immediately, record the state, and tell the team if any of these happen:

- A shared service degrades.
- Any real user data is reached.
- A critical finding is confirmed.

## Handling of findings

- A High or Critical finding in our own code that has a small, testable fix is fixed on this epic
  branch and retested, with the retest recorded in the report.
- Anything larger becomes a Jira task linked to AICHAT-29, with the retest status noted.
- Lower-severity findings are listed in the report and ticketed where a fix is planned.
