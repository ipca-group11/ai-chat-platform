# SAST in ai-chat-platform

## Decision: Semgrep CE (AICHAT-35)

| Criterion | Semgrep CE | CodeQL |
|---|---|---|
| Licence on this private repo | Free (LGPL engine, open rule packs), no account needed | Needs GitHub Code Security (Advanced Security), paid per active committer on private repos |
| Where results go | Job summary + SARIF artifact. The Security tab also needs GHAS, so we do not use it | Security tab (needs GHAS) |
| Speed | About 15 s locally, no build step | 5 to 10 min, needs a build for JS/TS extraction |
| Coverage for us | TS/JS, Dockerfile, GitHub Actions, custom rules in YAML | Deeper data flow, workflows too |
| Weak point | Cross-file data flow is limited in CE | Cost |

We chose **Semgrep CE**, run through the pinned Docker image `semgrep/semgrep:1.140.0`. We would switch to CodeQL if the organisation enables Code Security or the repository becomes public.

Severity policy: `ERROR` is "high" and blocks the merge. `WARNING`, `INFO` and the other levels are listed in the job summary and do not block.

Scope: all TypeScript/JavaScript, Dockerfiles and GitHub Actions workflows. Generated code (`dist`, `coverage`, `node_modules`, Prisma client, `.nx`, `@mf-types`) is excluded in `.semgrepignore`.

## Run it locally

Needs Docker running.

```sh
scripts/ci/semgrep.sh                                      # writes semgrep-results/semgrep.sarif
node scripts/ci/sast-summary.mjs semgrep-results/semgrep.sarif   # table; exit 1 when an ERROR is left
```

Both steps in one command, the same gate as CI: `pnpm sast`. `semgrep.sh` alone always exits 0; only the summary step fails on an ERROR finding.

`.semgrep.yml` holds our own rules. The registry packs (`p/typescript`, `p/react`, `p/expressjs`, `p/nodejsscan`, `p/jwt`, `p/secrets`, `p/github-actions`, `p/dockerfile`, `p/owasp-top-ten`) are listed in `scripts/ci/semgrep.sh`. To use another image version: `SEMGREP_IMAGE=semgrep/semgrep:<tag> scripts/ci/semgrep.sh`.

## Waive a finding

1. Prefer fixing it.
2. If it is a false positive in one line, add two comment lines right above it: the reason, then `nosemgrep: <short-rule-id>` (the last part of the rule id; the full dotted id is not matched).
3. Whatever you waive, add a row to `docs/AICHAT-27/WAIVERS.md` with the reason.
4. Whole-file or whole-folder exclusions go in `.semgrepignore` and also need a row in `WAIVERS.md`.

## Required check

The `sast` job in `.github/workflows/security.yml` must be a required status check on `integration/testing-epics` (the owner sets it in Settings > Branches). After the final PR the owner adds the same check to `main`.
