ARG NODE_VERSION=22.21.1
ARG NODE_IMAGE_DIGEST=sha256:25b3eb23a00590b7499f2a2ce939322727fcce1b15fdd69754fcd09536a3ae2c

FROM node:${NODE_VERSION}-bookworm-slim@${NODE_IMAGE_DIGEST} AS base

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
  NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS build-dependencies

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci --workspace @finhand/web --include-workspace-root

FROM build-dependencies AS build

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN test -n "$NEXT_PUBLIC_API_URL"

COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web/next-env.d.ts apps/web/next.config.ts apps/web/postcss.config.mjs \
  apps/web/tsconfig.json ./apps/web/
COPY apps/web/src ./apps/web/src

RUN npm run build --workspace @finhand/web

FROM base AS runtime

ENV NODE_ENV=production \
  HOSTNAME=0.0.0.0 \
  PORT=3000

COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node
WORKDIR /app/apps/web

EXPOSE 3000

CMD ["node", "server.js"]

