# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN pnpm install --frozen-lockfile || pnpm install

# ---- Build ----
FROM deps AS build
COPY apps/web ./apps/web
COPY packages ./packages
RUN pnpm --filter @7f/types build
RUN pnpm --filter @7f/utils build
RUN pnpm --filter @7f/config build
RUN pnpm --filter web build

# ---- Runtime ----
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
