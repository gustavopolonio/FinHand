ARG NODE_VERSION=22.21.1
ARG NODE_IMAGE_DIGEST=sha256:25b3eb23a00590b7499f2a2ce939322727fcce1b15fdd69754fcd09536a3ae2c

FROM node:${NODE_VERSION}-bookworm-slim@${NODE_IMAGE_DIGEST} AS base

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

FROM base AS build-dependencies

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci --workspace @finhand/api --include-workspace-root

FROM build-dependencies AS build

COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src

RUN npm run build --workspace @finhand/api

FROM base AS production-dependencies

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci --omit=dev --omit=optional --omit=peer \
  --workspace @finhand/api --include-workspace-root=false \
  && npm cache clean --force

FROM base AS runtime

ENV NODE_ENV=production \
  API_HOST=0.0.0.0 \
  API_PORT=3001

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/api ./apps/api
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist

USER node
WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/server.js"]

