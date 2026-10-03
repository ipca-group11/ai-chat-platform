# mfe-chat — Module Federation remote. Multi-stage build assuming a pnpm workspace root,
# with this app at apps/mfe-chat. Build context is the repo root:
#   docker build -f apps/mfe-chat/Dockerfile .
#
# apps/mfe-chat/src/shared/api-client.ts calls conversation-service through a same-origin
# `/api` path unless the host page injects `window.__CONVERSATION_API_URL__` at runtime;
# apps/shell's preview server proxies `/api` -> conversation-service (see
# apps/shell/vite.config.ts), so no build-time URL is needed here.

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/mfe-chat/package.json ./apps/mfe-chat/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @app/ui run build
RUN pnpm --filter @app/mfe-chat run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/mfe-chat/node_modules ./apps/mfe-chat/node_modules
COPY --from=build /workspace/apps/mfe-chat/dist ./apps/mfe-chat/dist
COPY --from=build /workspace/apps/mfe-chat/package.json ./apps/mfe-chat/package.json
COPY --from=build /workspace/apps/mfe-chat/vite.config.ts ./apps/mfe-chat/vite.config.ts

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /workspace
USER app

WORKDIR /workspace/apps/mfe-chat
EXPOSE 3002
# Invoke the locally installed vite binary directly rather than `pnpm exec`: the runtime
# stage doesn't copy the root package.json/pnpm-workspace.yaml (only node_modules), so
# `pnpm exec` here has no workspace/packageManager context to resolve against and fails
# at container start with a workspace-resolution error.
CMD ["node_modules/.bin/vite", "preview", "--port", "3002", "--host", "0.0.0.0"]
