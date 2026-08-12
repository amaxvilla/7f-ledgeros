# Deployment Guide

Stage FC-5 (Documentation). Synthesized directly from `docker-compose.yml`,
`docker/api.Dockerfile`, `docker/worker.Dockerfile`, `docker/web.Dockerfile`,
`scripts/backup.sh`/`scripts/restore.sh`, and the API/worker health
controllers — all read in full for this checkpoint, not assumed from
`docker-compose.yml`'s references to them. See
[`environment-configuration.md`](./environment-configuration.md) for every
variable referenced below.

## Architecture

Five services, orchestrated by `docker-compose.yml`:

| Service | Image / build | Port | Depends on |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5432` | — |
| `redis` | `redis:7-alpine` | `6379` | — |
| `api` | `docker/api.Dockerfile` | `4000` | postgres (healthy), redis (healthy) |
| `worker` | `docker/worker.Dockerfile` | `4100` | postgres, redis, api (all healthy) |
| `web` | `docker/web.Dockerfile` | `3000` | api |
| `backup` | `postgres:16-alpine` + `scripts/backup.sh` | — | postgres (healthy) |

`api` and `worker` both connect to Postgres/Redis using the compose
network's own service hostnames (`postgres`, `redis`), not `localhost` —
`docker-compose.yml` builds `DATABASE_URL`/`REDIS_URL` for both from the
same `POSTGRES_*` variables, so they can't drift apart between services.
`worker` reaches `api` over the compose network too, via
`INTERNAL_API_BASE_URL=http://api:4000/api/v1` — this is why `worker`
waits on `api`'s own healthcheck, not just Postgres/Redis.

## Local development via Docker

```bash
cp .env.example .env
# fill in every CHANGE_ME placeholder — see environment-configuration.md
docker compose up --build
```

- `web` → http://localhost:3000
- `api` → http://localhost:4000 (health: `/health`, `/ready`, `/live`)
- `worker` → http://localhost:4100 (health: `/live`, `/ready`, `/health`;
  its own BullMQ dashboard when `QUEUE_DASHBOARD_ENABLED=true`, the
  compose default)
- Postgres/Redis data persist in the named volumes `pg_data`/`redis_data`
  across restarts; `docker compose down -v` discards them.

Each Dockerfile is a 3-stage build (`deps` → `build` → `runtime`): `deps`
installs only the workspace's own `package.json` files first (for layer
caching), `build` compiles `@7f/types`/`@7f/utils`/`@7f/config` (all
three), plus `@7f/queue`/`@7f/logger` (api/worker only) or `@7f/ui`
(web only), runs `prisma generate` (api/worker only — `web` never touches
Prisma directly), then builds the app itself; `runtime` is a fresh
`node:20-alpine` layer with only the built output copied in, not the
build toolchain. `NODE_ENV=production` is set in every runtime stage —
this is what triggers `JWT_ACCESS_SECRET`'s own fatal-if-missing check
documented in `environment-configuration.md`.

**Known local-environment gap, confirmed directly, not assumed**: this
session's own sandboxed environment gets a `403 Forbidden` from
`binaries.prisma.sh` on `prisma generate` (re-verified in FC-5.1's own
checkpoint) — the same failure `docker/api.Dockerfile`'s and
`docker/worker.Dockerfile`'s own `RUN pnpm exec prisma generate` step
would hit if Prisma's engine binaries aren't otherwise cached or
reachable from wherever the image is actually built. Confirm binary
fetch access (or a pre-warmed Docker layer/build cache with the engine
already downloaded) before relying on a from-scratch `docker compose
build` in a similarly restricted network.

## Local (non-Docker) development and CI

`apps/api` and `apps/worker` both depend on five workspace packages
(`@7f/types`, `@7f/utils`, `@7f/config`, `@7f/queue`, `@7f/logger`) via
their own compiled `dist/` output, not their TypeScript source directly
— confirmed directly against each package's own `package.json`
(`main`/`types` both point at `dist/`). **Inside `docker compose build`
this is already handled**: each Dockerfile's own `build` stage runs
`pnpm --filter <pkg> build` for all five, in order, before building the
app itself (see the previous section). **Outside Docker — a bare
`pnpm install` on a fresh checkout, then `pnpm --filter api test` or
`npx tsc --noEmit` directly inside `apps/api`/`apps/worker`** — nothing
built those five packages, so every import of them fails to resolve
(confirmed directly: a fresh checkout without this step produces 26
`Cannot find module '@7f/config'`-class errors across `apps/api` alone).

This is now handled automatically for the two most common entry
points: the root `package.json`'s own `prebuild`/`pretest` scripts, and
matching `prebuild`/`pretest` scripts on `apps/api`/`apps/worker`
themselves, all invoke `pnpm run build:packages` (or the equivalent
`pnpm --filter <pkg>...build` list) before `build`/`test` run — so a
bare `pnpm build`, `pnpm test`, `pnpm --filter api test`, or
`pnpm --filter worker build` each build the five packages first,
whichever workspace scope they're invoked from. Confirmed directly this
checkpoint: deleting all five `dist/` directories, then running
`pnpm --filter api test` from a fresh shell, rebuilds all five before
Jest starts.

**Two things this does not cover**, both worth knowing rather than
assuming the hook is exhaustive:
- `test:watch`/`test:cov`/`test:e2e` (and any other script name that
  isn't the literal `test`/`build`) do **not** trigger `pretest`/
  `prebuild` — pnpm/npm's lifecycle-hook convention only fires for a
  script whose name exactly matches `pre<name>`. Run `pnpm test` (or
  `pnpm run build:packages` directly) at least once first if starting
  from a completely fresh checkout and reaching for one of these
  instead.
- `apps/web` depends on a sixth workspace package, `@7f/ui` — but
  **does not** share this gap, confirmed directly (not assumed from the
  package's own `main`/`types` shape alone): `apps/web/tsconfig.json`
  maps `@7f/ui` straight to `packages/ui/src` via a `paths` entry, and
  `next.config.js` lists it under `transpilePackages`, so both `tsc`
  and Next's own bundler consume `@7f/ui`'s TypeScript source directly
  — `packages/ui/dist` was deleted and `npx tsc --noEmit` inside
  `apps/web` re-run to confirm zero resolution errors before writing
  this. `apps/api`/`apps/worker` have no equivalent `paths`/
  `transpilePackages` override for their own five packages, which is
  why they need this checkpoint's fix and `apps/web` doesn't.
  (`packages/ui`'s own separate FC-1.9/FC-1.5-era gap was about
  something else — its own build/test setup, not this dist-consumption
  question — and remains unverified here either way.)

## Continuous Integration

`.github/workflows/ci.yml` (added FC-6.47 — before this checkpoint, no CI
pipeline existed anywhere in this repository, confirmed directly by
searching for `.github/workflows/`, `.gitlab-ci.yml`, and a `Jenkinsfile`
before writing one). Runs on every push and pull request against `main`:
install → generate the Prisma client → lint → typecheck `api`/`worker`/
`web` → test → build, using the same `pnpm run <script>` entry points
described in the section above — so the `prebuild`/`pretest` hooks that
build the five workspace packages fire the same way in CI as they do
locally, without a separate explicit step for it.

No Postgres/Redis service container is started in CI. Confirmed directly
before deciding this, not assumed: every `*.spec.ts` in this repository
mocks `PrismaService`/Redis rather than connecting to a real instance,
and no `*.e2e-spec.ts` file exists yet despite
`apps/api/test/jest-e2e.json` being scaffolded for one — so nothing the
pipeline currently runs needs a live database. `DATABASE_URL` is set to
an unreachable placeholder purely because `prisma generate`'s own schema
reads it via `env()` and fails fast if the variable is unset entirely —
`generate` never actually connects to it. The workflow will need a
`services:` block added the moment a real `*.e2e-spec.ts` file is
introduced.

## Health checks

Both `api` and `worker` expose the same three-endpoint shape (confirmed
directly against both `HealthController`s, not assumed symmetric):

- **`/live`** — process is up, does not check dependencies. Used by each
  service's own Docker `HEALTHCHECK`.
- **`/ready`** — checks Postgres and Redis are actually reachable; returns
  `503` if either is down. Use this for load-balancer/orchestrator
  readiness probes, not `/live`.
- **`/health`** — the same dependency checks as `/ready`, but always
  returns `200` with a `status: "healthy" | "degraded"` body — meant for
  dashboards/alerting that want a body to parse rather than an HTTP
  status to branch on.

## Production deployment checklist

1. **Secrets**: every `CHANGE_ME` in `.env.example` — especially
   `JWT_ACCESS_SECRET` (fatal startup error in production if unset, not
   merely insecure) — set from a real secrets manager, not committed.
2. **Database**: point `DATABASE_URL` at a managed/durable Postgres
   instance, not the `postgres` compose service's own local volume — that
   service is sized for local dev, not production durability.
3. **Backups**: the `backup` service (`scripts/backup.sh`) runs
   `pg_dump` on a loop (`BACKUP_INTERVAL_SECONDS`, default daily) with
   `BACKUP_RETENTION_DAYS`-based pruning (default 30), writing to
   `./storage/backups` on the host. For a managed Postgres instance in
   production, prefer that provider's own point-in-time-recovery/backup
   mechanism over this script, or at minimum point `BACKUP_DIR` at
   durable, off-host storage — a host-local volume is a single point of
   failure. The script also has a built-in off-host option: set
   `BACKUP_S3_BUCKET` (see `docs/environment-configuration.md`) to
   upload each dump to S3 after the local one succeeds, requiring the
   `aws` CLI and AWS credentials in the `backup` service's own
   environment — neither is set up by this compose file by default.
   `scripts/restore.sh` is destructive by design (restores
   in-place into `PGDATABASE`); the script's own header recommends
   restoring into a fresh database first and verifying before pointing
   production traffic at it.
4. **Storage volume**: `api` and `worker` both mount `./storage` — confirm
   this is durable, shared storage in production (not per-container
   ephemeral disk), since both services write to it.
5. **`NEXT_PUBLIC_API_URL`**: must be the API's own public URL, reachable
   from end users' browsers — the compose default
   (`http://localhost:4000/api/v1`) only works for same-host local dev.
6. **`INTERNAL_API_BASE_URL`**: worker → API traffic. In production this
   should stay on a private/internal network path, not necessarily the
   same public URL as `NEXT_PUBLIC_API_URL`.
7. **SMTP**: worker sends mail via `SMTP_*`/`MAIL_FROM_ADDRESS` — all
   blank by compose default (mail silently no-ops without them,
   confirmed in `environment-configuration.md`); set for production if
   any email-dependent feature is in use.
8. **Health probes**: wire `/ready` (not `/live`) into whatever
   orchestrator or load balancer decides traffic eligibility.

## What this guide does not cover

Container orchestration beyond `docker-compose.yml` itself (Kubernetes
manifests, a managed-container-service equivalent, autoscaling, ingress/
TLS termination) — none of that exists anywhere in this repository today,
confirmed by the same grep sweep FC-5.1 already ran for environment
variables; nothing to synthesize a guide from. Worth its own checkpoint
if/when that infrastructure is actually introduced, not assumed here.
