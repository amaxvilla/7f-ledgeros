# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/logger/package.json ./packages/logger/package.json
RUN pnpm install --frozen-lockfile || pnpm install

# ---- Build ----
FROM deps AS build
COPY prisma ./prisma
COPY apps/worker ./apps/worker
COPY packages ./packages
RUN pnpm --filter @7f/types build
RUN pnpm --filter @7f/utils build
RUN pnpm --filter @7f/config build
RUN pnpm --filter @7f/queue build
RUN pnpm --filter @7f/logger build
RUN pnpm exec prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter worker build

# ---- Runtime ----
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${WORKER_HTTP_PORT:-4100}/live || exit 1
CMD ["node", "apps/worker/dist/main.js"]
