# ---- Base ----
FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
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

RUN rm -rf /app/apps/worker/dist \
    /app/apps/worker/tsconfig.tsbuildinfo

RUN echo "=== VERIFY WORKER SOURCE ===" \
    && test -f /app/apps/worker/src/app.module.ts \
    && test -f /app/apps/worker/src/main.ts \
    && echo "FOUND: app.module.ts" \
    && echo "FOUND: main.ts"

RUN pnpm --filter @7f/types build
RUN pnpm --filter @7f/utils build
RUN pnpm --filter @7f/config build
RUN pnpm --filter @7f/queue build
RUN pnpm --filter @7f/logger build

RUN pnpm exec prisma generate --schema=prisma/schema.prisma

RUN rm -rf /app/apps/worker/dist \
    /app/apps/worker/tsconfig.tsbuildinfo \
    && pnpm --filter worker run build

RUN echo "=== VERIFY WORKER BUILD OUTPUT ===" \
    && test -f /app/apps/worker/dist/main.js \
    && test -f /app/apps/worker/dist/app.module.js \
    && echo "FOUND: dist/main.js" \
    && echo "FOUND: dist/app.module.js" \
    && ls -la /app/apps/worker/dist

# ---- Runtime ----
FROM node:20-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app ./

RUN echo "=== VERIFY RUNTIME ARTIFACT ===" \
    && node --version \
    && openssl version \
    && test -f /app/apps/worker/dist/main.js \
    && test -f /app/apps/worker/dist/app.module.js \
    && echo "RUNTIME ARTIFACT CHECK PASSED"

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.WORKER_HTTP_PORT || 4100) + '/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/worker/dist/main.js"]
