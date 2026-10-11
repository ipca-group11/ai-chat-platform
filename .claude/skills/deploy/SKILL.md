---
name: deploy
description: Deploy, check, or roll back the AI chat platform on the Azure VM (GHCR images + docker compose + Caddy). Use for "deploy", "deploy to Azure", "check the deploy", "roll back", "why did the deploy fail", "redeploy commit X".
---

# Deploy

Full reference: `deploy/azure/README.md`. Pipeline: `.github/workflows/deploy.yml`. Read those only when a step below is not enough.

## Facts

| Item | Value |
|---|---|
| Trigger | `CI` workflow succeeds on `main`, or manual `workflow_dispatch` |
| Images | `ghcr.io/<owner>/<repo>/<name>:<sha>` and `:latest` (10 images, built by the `build` matrix) |
| VM | `azureuser@ai-chat-jpc.swedencentral.cloudapp.azure.com`, stack in `~/ai-chat/` |
| Prod files | `deploy/azure/docker-compose.yml`, `deploy/azure/Caddyfile` (copied to the VM by the job) |
| GitHub config | secrets `VM_SSH_KEY`, `VM_KNOWN_HOSTS`; variable `DOMAIN`; environment `production` |
| VM secrets | `~/ai-chat/.env` (not in git, mode 600). Never print it. Never change `POSTGRES_PASSWORD` after first boot |

## Deploy

1. Confirm the target commit is on `main` and CI is green: `gh run list --workflow CI --branch main --limit 3`.
2. Normally merging to `main` is the deploy. To run it by hand: `gh workflow run deploy` (then `gh run watch`).
3. Jobs: `build` (matrix) → `sbom-third-party` → `scan-sbom` (report only) → `deploy` (scp compose files, `docker compose pull`, `up -d --wait`, Caddy reload) → smoke test on `https://$DOMAIN/`.
4. Report the run URL and the final job status. A deploy to production is outward-facing: ask the owner before triggering it by hand.

## Check a deploy

- Run status: `gh run list --workflow deploy --limit 5`, failures: `gh run view <id> --log-failed`.
- Live app: `curl -fsS -o /dev/null -w '%{http_code}\n' https://ai-chat-jpc.swedencentral.cloudapp.azure.com/`.
- On the VM: `ssh azureuser@<host> 'cd ~/ai-chat && docker compose ps'` and `docker compose logs --tail 100 <service>`.
- Which commit is running: the image tag in `docker compose ps` (it is the commit SHA).

## Roll back

Ask the owner first. Then either:
- `gh workflow run deploy --ref <old-sha>` is not enough on its own, because the SHA comes from the checked-out ref. Run it against a branch/tag that points at the old commit, or
- on the VM: `cd ~/ai-chat && IMAGE_PREFIX=ghcr.io/<owner>/<repo> IMAGE_TAG=<old sha> docker compose up -d` (log in to GHCR first if the image is not cached).

## Common failures

| Symptom | Likely cause |
|---|---|
| `build` fails for one image | that Dockerfile or its build args; read the matrix job log |
| ssh step fails | `VM_SSH_KEY` / `VM_KNOWN_HOSTS` secret wrong or VM host key changed |
| `up --wait` times out | unhealthy container; check `docker compose ps` and logs on the VM |
| New route returns old behaviour | Caddyfile changed but Caddy was not reloaded (the job does it; check that step) |
| Shell calls wrong remote URL | `DOMAIN` variable changed; the URLs are baked into the shell image at build time, so rebuild |

## Rules

- Do not put secrets in commands, logs, or commits.
- Do not run `az group delete` or touch the NSG without an explicit request.
- Commit messages and docs follow the AICHAT conventions: no AI mentions or co-author trailers.
