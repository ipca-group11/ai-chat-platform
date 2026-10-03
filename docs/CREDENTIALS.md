# Credentials

Where every credential for the Azure deployment comes from, where it lives, and how to
read or rotate it. **No secret values are in this file.** A local snapshot of the values
is kept in `.env.credentials` at the repo root, which is gitignored and has mode 600.

| Credential | Where it lives (source of truth) | How it was created |
|---|---|---|
| Azure login | Your Azure account (`az login`) | Interactive login |
| VM SSH access | `~/.ssh/id_ed25519` on your machine → VM `~/.ssh/authorized_keys` | Your existing key, passed to `az vm create --ssh-key-values` |
| CI deploy key | GitHub secret `VM_SSH_KEY` (private) → VM `authorized_keys` (public) | `ssh-keygen` at setup; private half uploaded with `gh secret set`, local copy deleted |
| VM host key | GitHub secret `VM_KNOWN_HOSTS` | `ssh-keyscan -t ed25519 <host>` |
| `POSTGRES_PASSWORD` | VM `~/ai-chat/.env` | `openssl rand -hex 24` on the VM at setup |
| `JWT_SECRET` | VM `~/ai-chat/.env` | `openssl rand -hex 32` on the VM at setup |
| Grafana admin password | VM `~/ai-chat/.env` (initial value) → Grafana database | `openssl rand -hex 12` on the VM at setup |
| GHCR pull token | Not stored | Each deploy run uses its short-lived `GITHUB_TOKEN`, then runs `docker logout` |
| App user accounts | Postgres `auth` schema (passwords stored as bcrypt hashes) | `POST /auth/register` with generated passwords |
| Anthropic / OpenAI API keys | Each user's browser (`localStorage`) | Pasted by the user in **Settings**; never stored server-side |

## How to read them

```sh
# Server secrets (Postgres, JWT, Grafana initial password)
ssh azureuser@ai-chat-jpc.swedencentral.cloudapp.azure.com 'cat ~/ai-chat/.env'

# Local snapshot of everything
cat .env.credentials

# Which GitHub secrets/variables exist (values can't be read back)
gh secret list && gh variable list
```

App user passwords can't be recovered from the database, because only hashes are stored.
The local snapshot in `.env.credentials` is the only copy.

## How to rotate them

- **Grafana password:** in Grafana, open the profile menu → **Change password**. The value in the VM's `.env` only applies when Grafana first starts; afterwards Grafana keeps the password in its own database. Update `.env.credentials`.
- **`JWT_SECRET`:** edit the VM's `~/ai-chat/.env`, then run `docker compose up -d` in `~/ai-chat`. Every user is logged out.
- **`POSTGRES_PASSWORD`:** Postgres only reads it on first boot. Change it inside Postgres (`ALTER USER llmchat PASSWORD '...'`), then update the VM's `.env` and run `docker compose up -d`.
- **CI deploy key:**
  1. `ssh-keygen -t ed25519 -f key`.
  2. Add `key.pub` to the VM's `~/.ssh/authorized_keys` and remove the old line.
  3. `gh secret set VM_SSH_KEY < key`.
  4. Delete `key`.
- **App user password:** the app has no change-password feature yet. Re-register under a new email, or update the bcrypt hash in the `auth` schema.

## Rules

- Never commit `.env`, `.env.credentials` or any key file. Both env files are in `.gitignore`.
- Share passwords privately, not in group chats or issues.
- Credentials were displayed in a terminal session during setup. Rotate the Grafana password and the app user passwords if that session log is shared.
