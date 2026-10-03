# mfe-settings — Module Federation remote. Multi-stage build assuming a pnpm workspace
# root, with this app at apps/mfe-settings. Build context is the repo root:
#   docker build -f apps/mfe-settings/Dockerfile .
#
# VITE_AUTH_SERVICE_URL / VITE_CONVERSATION_SERVICE_URL are read at *build* time
# (apps/mfe-settings/src/features/api-keys/api/*.ts, via import.meta.env) and baked into
# the bundle. They default to same-origin (`/auth`, `/api`), proxied by the shell, so the
# session cookie is always sent. See compose.yaml / docs/DEPLOY.md.

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/mfe-settings/package.json ./apps/mfe-settings/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG VITE_AUTH_SERVICE_URL=
ARG VITE_CONVERSATION_SERVICE_URL=/api
ENV VITE_AUTH_SERVICE_URL=${VITE_AUTH_SERVICE_URL} \
    VITE_CONVERSATION_SERVICE_URL=${VITE_CONVERSATION_SERVICE_URL}
RUN pnpm --filter @app/ui run build
RUN pnpm --filter @app/mfe-settings run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/mfe-settings/node_modules ./apps/mfe-settings/node_modules
COPY --from=build /workspace/apps/mfe-settings/dist ./apps/mfe-settings/dist
COPY --from=build /workspace/apps/mfe-settings/package.json ./apps/mfe-settings/package.json
COPY --from=build /workspace/apps/mfe-settings/vite.config.ts ./apps/mfe-settings/vite.config.ts
# vite.config.ts imports the shared coverage preset, so `vite preview` needs it at runtime
COPY --from=build /workspace/packages/test-config ./packages/test-config

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /workspace
USER app

WORKDIR /workspace/apps/mfe-settings
EXPOSE 3003
# Invoke the locally installed vite binary directly rather than `pnpm exec`: the runtime
# stage doesn't copy the root package.json/pnpm-workspace.yaml (only node_modules), so
# `pnpm exec` here has no workspace/packageManager context to resolve against and fails
# at container start with a workspace-resolution error.
CMD ["node_modules/.bin/vite", "preview", "--port", "3003", "--host", "0.0.0.0"]
