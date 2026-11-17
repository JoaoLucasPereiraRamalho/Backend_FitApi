# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

# Dependências completas, cliente Prisma e compilação.
FROM base AS build
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Só as dependências de produção; o cliente Prisma já foi compilado para dist/.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PROCESS_ROLE=api
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "./scripts/docker-entrypoint.sh"]
