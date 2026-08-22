# ---- Base ----
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/logger/package.json ./packages/logger/package.json
RUN pnpm install --frozen-lockfile || pnpm install

# ---- Build ----
FROM deps AS build
COPY prisma ./prisma
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm --filter @7f/types build
RUN pnpm --filter @7f/utils build
RUN pnpm --filter @7f/config build
RUN pnpm --filter @7f/queue build
RUN pnpm --filter @7f/logger build
RUN pnpm exec prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter api build

# ---- Runtime ----
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl wget
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
CMD sh -c "pnpm exec prisma migrate deploy --schema=prisma/schema.prisma && node apps/api/dist/main.js"