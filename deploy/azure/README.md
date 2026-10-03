# Azure VM deploy

One small VM runs the whole stack from prebuilt images, with Caddy in front for HTTPS.
GitHub Actions builds the images, and the VM only pulls and runs them.

| | |
|---|---|
| Resource group | `rg-ai-chat` (Sweden Central) |
| VM | `vm-ai-chat`, `Standard_B2als_v2` (2 vCPU x86, 4 GB RAM + 4 GB swap), Ubuntu 24.04 |
| URL | https://ai-chat-jpc.swedencentral.cloudapp.azure.com |
| SSH | `ssh azureuser@ai-chat-jpc.swedencentral.cloudapp.azure.com` |
| Cost | ~€33/month (VM ~€25, 64 GB Standard SSD ~€5, static IP ~€3.30). Budget alert `ai-chat-60` on the RG. |

The VM is x86, not ARM, because the repo is private. GitHub's free hosted runners are
x86, and building ARM images under QEMU is slow and costs a lot of CI minutes.

## Pipeline

`.github/workflows/deploy.yml` runs after `CI` passes on `main`, or by hand from the Actions tab:

1. **build** (one matrix job per image): builds each Dockerfile for `linux/amd64` and pushes
   `ghcr.io/<owner>/<repo>/<service>:<sha>` and `:latest`. The shell gets the remotes'
   public URLs (`https://$DOMAIN:300x`) as build args.
2. **deploy**: copies `docker-compose.yml` + `Caddyfile` to `~/ai-chat/` on the VM over SSH,
   logs the VM into GHCR with the job's short-lived token, then runs
   `docker compose pull && up -d --wait` with `IMAGE_TAG=<sha>`, then a smoke test against the URL.

GitHub configuration:

| Name | Kind | Value |
|---|---|---|
| `VM_SSH_KEY` | secret | private key of a deploy-only key pair (its public half is in the VM's `authorized_keys`) |
| `VM_KNOWN_HOSTS` | secret | `ssh-keyscan -t ed25519 <host>` output, so the job verifies the VM's host key |
| `DOMAIN` | variable | `ai-chat-jpc.swedencentral.cloudapp.azure.com` |

**Rollback:** redeploy an older commit with **Run workflow**, or on the VM:
`cd ~/ai-chat && IMAGE_PREFIX=ghcr.io/<owner>/<repo> IMAGE_TAG=<old sha> docker compose up -d`
(log in to GHCR first if the image isn't cached locally).

## On the VM

`~/ai-chat/.env` holds the secrets. It was generated on the VM, isn't in git, and has mode 600:
`DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `GRAFANA_ADMIN_PASSWORD`.
Don't change `POSTGRES_PASSWORD` after first boot: Postgres only reads it when it initialises its volume.

Open inbound ports (NSG `vm-ai-chatNSG`): 22, 80, 443, 3001-3003. Ports 3001-3003 are the
Module Federation remotes, which the shell loads from the browser on their own origins.
Grafana (3300) and Prometheus (9090) are bound to the VM's loopback; reach Grafana with
`ssh -L 3300:127.0.0.1:3300 azureuser@<host>`.

LLM keys are not configured on the server: each user pastes their Anthropic key in
Settings, and the browser sends it with each request.

## Files

- `docker-compose.yml`: production stack (pull-only; `IMAGE_PREFIX`/`IMAGE_TAG` come from the deploy job).
- `Caddyfile`: TLS + reverse proxy (rewrites `Host` for Vite preview, sets CORS for the remotes).
- `cloud-init.yaml`: first-boot setup (Docker, swap, unattended upgrades).

## Recreate from scratch

```sh
az group create -n rg-ai-chat -l swedencentral
az vm create -g rg-ai-chat -n vm-ai-chat \
  --image Canonical:ubuntu-24_04-lts:server:latest --size Standard_B2als_v2 \
  --admin-username azureuser --ssh-key-values ~/.ssh/id_ed25519.pub \
  --os-disk-size-gb 64 --storage-sku StandardSSD_LRS \
  --public-ip-sku Standard --public-ip-address-dns-name ai-chat-jpc \
  --nsg-rule SSH --custom-data deploy/azure/cloud-init.yaml
az network nsg rule create -g rg-ai-chat --nsg-name vm-ai-chatNSG -n web --priority 1010 \
  --access Allow --protocol Tcp --direction Inbound --destination-port-ranges 80 443 3001-3003
```

Then create `~/ai-chat/.env` on the VM, add a deploy key to `~/.ssh/authorized_keys`, and
update the `VM_SSH_KEY`/`VM_KNOWN_HOSTS` secrets.

Delete everything (stops all charges): `az group delete -n rg-ai-chat`.
