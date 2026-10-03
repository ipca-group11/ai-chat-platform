# shell — Module Federation host. Multi-stage build assuming a pnpm workspace root, with
# this app at apps/shell. Build context is the repo root:
#   docker build -f apps/shell/Dockerfile .
#
# The Module Federation remote entry URLs (mfe-auth/mfe-chat/mfe-settings) are read at
# *build* time by apps/shell/module-federation.config.ts (via process.env.VITE_MFE_*_URL)
# and baked into the built bundle the browser loads, so they must resolve from the
# *browser's* point of view (i.e. the host-published port for each remote), not from
# inside the Docker network. See compose.yaml / docs/DEPLOY.md.

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/shell/package.json ./apps/shell/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG VITE_MFE_AUTH_URL=http://localhost:3001
ARG VITE_MFE_CHAT_URL=http://localhost:3002
ARG VITE_MFE_SETTINGS_URL=http://localhost:3003
# Grafana Faro collector URL (empty = Faro off) and the build's version, both baked into
# the bundle; see src/shared/observability/faro.ts.
ARG VITE_FARO_URL=
ARG VITE_APP_VERSION=dev
ENV VITE_MFE_AUTH_URL=${VITE_MFE_AUTH_URL} \
    VITE_MFE_CHAT_URL=${VITE_MFE_CHAT_URL} \
    VITE_MFE_SETTINGS_URL=${VITE_MFE_SETTINGS_URL} \
    VITE_FARO_URL=${VITE_FARO_URL} \
    VITE_APP_VERSION=${VITE_APP_VERSION}
RUN pnpm --filter @app/ui run build
RUN pnpm --filter @app/shell run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/shell/node_modules ./apps/shell/node_modules
COPY --from=build /workspace/apps/shell/dist ./apps/shell/dist
COPY --from=build /workspace/apps/shell/package.json ./apps/shell/package.json
COPY --from=build /workspace/apps/shell/vite.config.ts ./apps/shell/vite.config.ts
COPY --from=build /workspace/apps/shell/module-federation.config.ts ./apps/shell/module-federation.config.ts

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /workspace
USER app

WORKDIR /workspace/apps/shell
EXPOSE 3000
# Invoke the locally installed vite binary directly rather than `pnpm exec`: the runtime
# stage doesn't copy the root package.json/pnpm-workspace.yaml (only node_modules), so
# `pnpm exec` here has no workspace/packageManager context to resolve against and fails
# at container start with a workspace-resolution error.
CMD ["node_modules/.bin/vite", "preview", "--port", "3000", "--host", "0.0.0.0"]
