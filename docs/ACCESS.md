# Access: VM and Deployed URLs

How to reach the Azure VM, and every URL the deployment serves. Credentials are explained
in [CREDENTIALS.md](CREDENTIALS.md); their values are in `.env.credentials`, which is gitignored.

**Host:** `ai-chat-jpc.swedencentral.cloudapp.azure.com` (static IP `51.107.187.205`)

## Public URLs

All traffic goes through Caddy with a Let's Encrypt certificate that renews automatically.
`http://` redirects to `https://` (308).

| URL | What it is | Expected response |
|---|---|---|
| https://ai-chat-jpc.swedencentral.cloudapp.azure.com/ | **The app** (shell, Module Federation host) | 200 |
| …/login · …/register | Sign in / create an account (mfe-auth) | 200 |
| …/chats | Chat UI (mfe-chat) | 200 (redirects to login when signed out) |
| …/settings | LLM provider API keys (mfe-settings) | 200 |
| …/auth/* | auth-service API (proxied by the shell) | `/auth/me` → 401 signed out, 200 signed in |
| …/api/* | conversation-service API (proxied by the shell, `/api` prefix stripped) | `/api/health` → 200 |
| …/grafana/ | **Grafana** (dashboards: *Platform overview*, *Frontend (Grafana Faro)*) | 302 → login |
| …/collect | Grafana Faro collector (Alloy); POST only, the browser sends here | POST 202, GET 405 |
| https://ai-chat-jpc.swedencentral.cloudapp.azure.com:3001/remoteEntry.js | mfe-auth remote | 200 |
| …:3002/remoteEntry.js | mfe-chat remote | 200 |
| …:3003/remoteEntry.js | mfe-settings remote | 200 |

Ports 3001–3003 are public because the shell loads each remote from its own origin in
the browser. They only serve static JS.

## Internal services (not public)

These are bound to the VM's loopback or reachable only on the Docker network.

| Service | Where | How to reach it |
|---|---|---|
| Prometheus | VM `127.0.0.1:9090` | SSH tunnel (below) → http://localhost:9090 |
| Grafana (direct) | VM `127.0.0.1:3300` | SSH tunnel → http://localhost:3300/grafana/ |
| Postgres | Docker network `postgres:5432` | `docker compose exec postgres psql -U llmchat llmchat` |
| Loki | Docker network `loki:3100` | Grafana → Explore → Loki |
| Alloy | Docker network `alloy:12347` | Through `/collect` only |
| auth-service / conversation-service | Docker network `:4001` / `:4002` | Through `/auth` and `/api` |

## Accessing the VM

### 1. SSH (the normal way)

Uses your SSH key `~/.ssh/id_ed25519`, which was installed as the VM's admin key when the
VM was created. The user is `azureuser`, and it can use `sudo` without a password.

```sh
ssh azureuser@ai-chat-jpc.swedencentral.cloudapp.azure.com
```

The firewall (NSG `vm-ai-chatNSG`) allows inbound 22, 80, 443 and 3001–3003.

### 2. SSH tunnel to internal services

```sh
ssh -L 9090:127.0.0.1:9090 -L 3300:127.0.0.1:3300 \
  azureuser@ai-chat-jpc.swedencentral.cloudapp.azure.com
# then open http://localhost:9090 (Prometheus)
```

### 3. Azure CLI (manage the VM itself)

Requires `az login` with access to subscription `6f74cf34-e8c5-406b-a688-9c16703ad5ba`.

```sh
az vm show  -g rg-ai-chat -n vm-ai-chat -d -o table   # status, IP
az vm start -g rg-ai-chat -n vm-ai-chat
az vm stop  -g rg-ai-chat -n vm-ai-chat     # stops the OS but still bills compute
az vm deallocate -g rg-ai-chat -n vm-ai-chat # stops compute billing (IP kept, static)
az vm restart -g rg-ai-chat -n vm-ai-chat
```

**If SSH stops working** (lost key, broken `authorized_keys`), use one of these:

```sh
# Run a command on the VM through the Azure agent, no SSH needed
az vm run-command invoke -g rg-ai-chat -n vm-ai-chat --command-id RunShellScript \
  --scripts "docker ps"

# Install a new SSH public key for azureuser
az vm user update -g rg-ai-chat -n vm-ai-chat -u azureuser --ssh-key-value "$(cat ~/.ssh/id_ed25519.pub)"
```

The Azure Portal also has a serial console: VM → Help → Serial console.

### 4. How CI accesses the VM

The `deploy` GitHub Actions workflow uses its own deploy-only key (secret `VM_SSH_KEY`) and
checks the VM's host key against `VM_KNOWN_HOSTS`. It copies `deploy/azure/docker-compose.yml`
and `Caddyfile` to `~/ai-chat/`, then runs `docker compose pull && up -d` there.

## Working on the VM

Everything runs from `~/ai-chat`, which holds `docker-compose.yml`, `Caddyfile` and `.env`.

The compose file needs `IMAGE_PREFIX`. Export it first, plus `IMAGE_TAG` (otherwise
`latest` is used):

```sh
cd ~/ai-chat
export IMAGE_PREFIX=ghcr.io/ipca-group11/ai-chat-platform
export IMAGE_TAG=$(docker inspect llm-chat-shell-1 --format '{{index .Config.Image}}' | cut -d: -f2)

docker compose ps                         # status of all containers
docker compose logs -f conversation-service --tail 100
docker compose restart auth-service
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
docker compose exec postgres psql -U llmchat llmchat
docker stats --no-stream                  # memory per container
free -h                                   # VM memory + swap
```

Deploy by merging to `main`, not by building on the VM. See
[deploy/azure/README.md](../deploy/azure/README.md) for the pipeline and rollback.

## Other links

| What | URL |
|---|---|
| GitHub repo | https://github.com/ipca-group11/ai-chat-platform |
| CI / deploy runs | https://github.com/ipca-group11/ai-chat-platform/actions |
| Container images (GHCR) | https://github.com/orgs/ipca-group11/packages?repo_name=ai-chat-platform |
| Azure resource group | Azure Portal → Resource groups → `rg-ai-chat` (Sweden Central) |
| Cost / budget alert | Azure Portal → Cost Management → Budgets → `ai-chat-60` |
