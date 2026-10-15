# AICHAT-6: Dependency vulnerability scanning (SCA)

**Threshold:** 0 high or critical advisories. The `sca` workflow ([sca.yml](../../.github/workflows/sca.yml))
runs `pnpm audit --audit-level=high` on every pull request, on pushes to `main`, daily at 04:00 UTC and on demand.
The job exits non-zero above the threshold, which fails the pull request.

## Run it locally

```bash
pnpm audit --audit-level=high   # exit 0 = within the threshold
pnpm audit                      # full list, including moderate and low
```

## Dependabot

[dependabot.yml](../../.github/dependabot.yml) opens weekly pull requests for the npm workspace (minor and patch
grouped), GitHub Actions and the Dockerfiles. Merge them like any other pull request: CI runs the audit on them.

## Findings fixed

At the start the audit reported 26 high and 2 critical advisories, all in transitive dependencies. They are fixed with
`pnpm.overrides` in the root `package.json`: `adm-zip`, `axios`, `basic-ftp`, `brace-expansion@5`, `smol-toml`,
`source-map-js`, `tmp`, `undici@7` and `simple-git` (>=4, used by promptfoo, a test tool only). Remove an override when
its parent package ships the fixed version itself.

## Waivers

No patched version exists for these, so they are listed in `pnpm.auditConfig.ignoreGhsas`. Review them when a fix is
published.

| Advisory | Package | Reached through | Reason |
|----------|---------|-----------------|--------|
| GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3 | extract-zip | `@lhci/cli` (Lighthouse CI) | No fix. Dev and CI tool only; it unzips the Chromium build it downloads itself, never user input. |
| GHSA-86w9-cpqp-85rv | node-forge | `promptfoo` | No fix. Test tool only (red-team job); not shipped in any image. |
| GHSA-vfj7-8cjw-p6xm | braces | `tailwindcss` > `chokidar` | No fix. Build-time file watching on our own globs; not shipped. |

## Not done

The moderate and low advisories (4 moderate) are not blocked by the threshold and are left for Dependabot.
