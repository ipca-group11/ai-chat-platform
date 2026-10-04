---
title: "AICHAT-29 · Penetration testing report"
---

# Penetration testing report

| | |
|---|---|
| Target | AI chat platform (our own), local staging copy |
| Date | 2026-10-04 |
| Method | Grey-box, OWASP WSTG 4.2 with ASVS 4.0 L1 references |
| Scoring | CVSS v3.1 base score |
| Rules | [RULES-OF-ENGAGEMENT.md](RULES-OF-ENGAGEMENT.md) |

## 1. Executive summary

We tested the eleven hypotheses from the code review (README §4) against a local staging
copy of the platform. Six were confirmed and two were refuted with live probes; three more
were assessed by reading the code and configuration, because they need the frontends or a
model provider that are out of this session's scope.

The most serious confirmed finding is **H2 (Critical):** conversation-service accepts any
HS256 token signed with the shared `JWT_SECRET`, and that secret has a committed insecure
default. An attacker who learns the secret — trivially, when the default is left in place —
can forge a token for any account. Two access-control hypotheses were **refuted**, which is
good news: refresh-token rotation invalidates a reused token, and a non-member is denied a
chat by id.

Nothing here is a new surprise: the highest findings already have Jira tickets
(the JWT default is the waived item AICHAT-210; the rate-limit and metrics findings are
AICHAT-222 and AICHAT-229). This assessment confirms them with running evidence and raises
tickets for the rest.

## 2. Scope and method

- **Target:** the production compose files brought up locally as a staging copy
  (`compose.yaml`: postgres, auth-service, conversation-service), seeded with throw-away
  test accounts. No cloud resource and no model provider were touched.
- **Method:** a TypeScript probe harness (`testing/pentest/`) drives the real service APIs
  and records each hypothesis as confirmed, refuted or inconclusive, with a CVSS v3.1 vector.
  The harness sends only the few requests each check needs; the rate-limit check uses four
  requests, never a flood.
- **Checklist mapping:** H1/H5 → WSTG Authorization; H2/H3 → Session management; H4 →
  Business logic / availability; H6 → Input validation (file upload); H7/H8 → Configuration
  and client-side; H9 → the prompt-injection work (AICHAT-26); H10/H11 → Configuration.

## 3. Findings

Confirmed first, then by severity. The live rows were produced by the harness
(`evidence/01-probes.log`); the grey-box rows are marked.

| # | Hypothesis | Result | Severity | CVSS v3.1 | How we know |
|---|---|---|---|---|---|
| H2 | Forgeable JWT: shared secret, insecure committed default, `Bearer` accepted | Confirmed | Critical | 9.8 | A token forged with the default secret was accepted on `GET /chats` (`evidence/02-h2-forged-jwt.log`) |
| H1 | Chat shared to an email is reachable by anyone who later registers it (no email verification) | Confirmed | High | 7.1 | Registered the invited address and read the owner's chat (HTTP 200) |
| H6 | Upload type trusts the client-supplied MIME (no magic-byte check); `pdf-parse` runs on untrusted PDFs; 20 MB read into memory | Confirmed (grey-box) | Medium | 5.3 | `attachments/validators.ts`: extension and MIME are matched against an allow-list, but both come from the client |
| H4 | One global rate-limit bucket and the proxy is not trusted, so all clients share one counter behind the gateway | Confirmed | Medium | 5.3 | `RateLimit-Remaining` fell across four requests that each spoofed a different `X-Forwarded-For` |
| H8 | No CSP/HSTS/X-Frame-Options on the frontends; the provider API key is kept in `sessionStorage`, so any XSS steals it | Confirmed (grey-box) | Medium | 6.1 | `deploy/azure/Caddyfile` sets no security headers on the shell or remotes |
| H11 | Dev default secrets are committed (`JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`) | Confirmed (grey-box) | Medium | 5.9 | `compose.yaml` and `.env.example` ship the defaults; production must override them |
| H7 | Prometheus `/metrics` is served without authentication | Confirmed | Low | 5.3 | `GET /metrics` returned Prometheus text with no auth on both services (`evidence/03-public-metrics.log`) |
| H9 | LLM web fetch has no domain allow-list and there is no system prompt | Confirmed (AICHAT-26) | Medium | — | Covered by the prompt-injection epic; tickets AICHAT-242/243 |
| H10 | Module Federation remotes on separate origins; CORS / remote-entry replacement | Inconclusive (grey-box) | Info | — | `Caddyfile` scopes `Access-Control-Allow-Origin` to the domain; a full test needs the running frontends |
| H3 | Refresh-token family not revoked on reuse | **Refuted** | Info | — | Reuse of a rotated token was rejected and a derived token did not keep working |
| H5 | IDOR: a non-member reads a chat by id | **Refuted** | Info | — | A non-member was denied the chat (HTTP 404); ownership/membership is enforced |

## 4. Detail of the confirmed findings

### H2 — Forgeable JWT (Critical)

conversation-service validates the access token locally with a shared `JWT_SECRET`
(`shared/auth-middleware.ts`) and also accepts an `Authorization: Bearer` header. The secret
has a committed default of `change-me-in-every-environment` (`shared/env.ts`, already waived
as AICHAT-210 / W5). On the staging copy — run with that default to demonstrate the risk — a
token forged with the default secret was accepted. Any environment that keeps the default,
or whose secret leaks, is fully impersonatable.

**Fix:** require `JWT_SECRET` with no default (fail fast on boot), rotate it per environment,
and consider short-lived asymmetric (RS256) tokens so the verifier never holds a signing key.
Tracked in AICHAT-210.

**Status:** the default is removed in AICHAT-210. Both services now refuse to boot without
`JWT_SECRET` (no code default in any environment). Rotation per environment and RS256 remain
recommendations.

### H1 — Chat sharing by unverified email (High)

Membership is matched on the email claim (`chats/service.ts`, `findManyAccessible` /
`findAccessible`) and registration performs no email-ownership check (`register/api.ts`). We
invited an address to a chat, then registered that address as a different person and read the
chat. Anyone can claim an unregistered invited address.

**Fix:** verify email ownership at registration (or before granting access through a shared
chat), and bind membership to a verified user id rather than a raw email. Ticketed.

**Status: fixed in AICHAT-253.**

- *auth-service.* A new account starts with `emailVerified = false` and gets a single-use token
  (32 random bytes, only its SHA-256 hash stored, valid 24 h). `POST /auth/verify-email
  {"token"}` marks the account verified (204); `POST /auth/verify-email/resend` (signed in,
  5 per hour) replaces the pending token. Access tokens carry `email_verified`; a verification
  shows up in the next token (sign-in or `POST /auth/refresh`). `GET /auth/me` returns
  `emailVerified`.
- *Delivery.* There is no mail provider, so delivery goes through a `Mailer` interface
  (`shared/mailer.ts`), chosen by `EMAIL_DELIVERY`: `log` writes the token (never the address)
  to the auth-service log, `off` sends nothing. The default is `log` outside production and `off`
  in production, because whoever reads the logs could otherwise verify any address. The local
  `compose.yaml` sets `log`. A real deployment plugs in an SMTP or API mailer that implements
  `Mailer`. Tests use an in-memory mailer.
- *conversation-service.* An invite (`ChatMember`) is still created by email, but it is
  claimed only by a user whose token says `email_verified: true`; the claim stores that user's
  id on the row (`ChatMember.userId`), and from then on access matches the user id only. A token
  without the claim counts as unverified. A later account with the same address does not
  inherit a bound invite, and a member leaving removes the row bound to them.
- *Migration.* Existing accounts start unverified and existing invites unbound, on purpose:
  nothing proves who registered those addresses. Their owners verify (resend) and the invites
  are claimed again on next access.
- *Tests.* `auth-service/src/integration/email-verification.spec.ts`,
  `conversation-service/src/integration/shared-chat-verification.spec.ts` (the H1 sequence
  with an unverified token now gets 404). The live probe (`testing/pentest/run.ts`, H1) was not
  re-run against the fixed build: Docker was not available.

### H4 — Shared rate-limit bucket (Medium)

auth-service uses one global `express-rate-limit` bucket (`limit: 300 / 15 min`) and sets no
`trust proxy`, so behind Caddy every client is keyed on the gateway IP and shares one counter.
A single client can exhaust the login budget for everyone. Tracked in AICHAT-222.

### H6, H7, H8, H11

- **H6:** the upload validator trusts the client MIME; add magic-byte sniffing, cap decode
  memory and sandbox `pdf-parse`. Ticketed.
- **H7:** `/metrics` is public; restrict it to the monitoring network or require a token.
  Tracked in AICHAT-229.
- **H8:** add CSP, HSTS and X-Frame-Options at Caddy, and move the provider key out of
  `sessionStorage`. Ticketed.
- **H11:** keep the committed values clearly marked as local-only and enforce per-environment
  secrets in the deployment. Overlaps AICHAT-251.

## 5. Retest status

No code behaviour was changed in this epic: the confirmed findings are security decisions or
features that belong in their own tickets, so each is recorded as **open, ticketed**. The
refuted hypotheses (H3, H5) need no further action. When the tickets are fixed, rerun
`node testing/pentest/run.ts` against the staging copy; a fixed finding flips from
"confirmed" to "refuted" in the same table.

## 6. Tickets

| Finding | Ticket |
|---|---|
| H2 JWT default | AICHAT-210 (existing waiver) |
| H1 unverified email → chat access | new |
| H4 shared rate limit | AICHAT-222 (existing) |
| H6 upload MIME trust | new |
| H7 public metrics | AICHAT-229 (existing) |
| H8 missing security headers / key in sessionStorage | AICHAT-228 + AICHAT-230 (existing) / new |
| H9 LLM web fetch + system prompt | AICHAT-242, AICHAT-243 (existing) |
| H11 committed default secrets | AICHAT-251 (existing) |
