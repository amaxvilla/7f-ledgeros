# Environment Configuration

Stage FC-5 (Documentation). Every variable below was found by grepping
`process.env.*` across `apps/api`, `apps/web`, `apps/worker`, and
`packages` directly (plus `prisma/schema.prisma`'s own `env("DATABASE_URL")`
and `docker-compose.yml`'s own compose-level variables) — not copied from
an existing template, since none existed anywhere in this repository
before this checkpoint. If you add a new `process.env.X` read anywhere in
the codebase, add it here in the same change; nothing enforces that
automatically.

A companion `.env.example` at the repository root lists every variable
below with its default (or a placeholder for anything with no safe
default) — copy it to `.env` and fill in the placeholders to get started.

**Not an environment variable, but the other thing a fresh checkout
needs before `apps/api`/`apps/worker` will typecheck or test outside
Docker**: five workspace packages need their own `dist/` built first.
See [deployment-guide.md § Local (non-Docker) development and
CI](./deployment-guide.md#local-non-docker-development-and-ci) — now
handled automatically by `pnpm build`/`pnpm test` at the root or inside
either app, but worth knowing about directly if reaching for a script
name that bypasses those hooks.

---

## Core / Database

| Variable | Used by | Required | Default | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | `apps/api`, `apps/worker` (via Prisma) | **Yes** | none | Postgres connection string, `postgresql://user:pass@host:5432/db?schema=public`. Read by Prisma itself via `env("DATABASE_URL")` in `prisma/schema.prisma`, not a direct `process.env` read in application code. |
| `NODE_ENV` | all apps | No | unset (treated as development) | Standard Node convention. Setting this to `production` changes real behavior in at least one place — see `JWT_ACCESS_SECRET` below. |
| `REDIS_URL` | `apps/api`, `apps/worker` | **Yes** in any environment using the job queue | none | BullMQ connection string, e.g. `redis://localhost:6379`. |

## API server

| Variable | Used by | Required | Default | Notes |
|---|---|---|---|---|
| `API_HOST` | `apps/api` | No | framework default (`0.0.0.0` typically) | Bind address. |
| `API_PORT` | `apps/api` | No | `4000` (per `docker-compose.yml`'s own default) | |
| `CORS_ORIGINS` | `apps/api` | No | permissive/unset in dev | Comma-separated allow-list for the frontend's own origin(s) in production. |
| `SWAGGER_ENABLED` | `apps/api` | No | — | Set to a falsy value to disable the `/api/docs` Swagger UI in production, if not needed there. |

## Authentication

| Variable | Used by | Required | Default | Notes |
|---|---|---|---|---|
| `JWT_ACCESS_SECRET` | `apps/api`, `apps/worker` (via `@7f/config`'s `getJwtAccessSecret()`) | **Yes in production** | `'dev-only-insecure-secret'` outside production | Confirmed directly against `packages/config/src/jwt.ts`: a missing value is a **fatal startup error** in `NODE_ENV=production` specifically — the insecure dev fallback is deliberately refused there, not silently reused. |
| `JWT_ACCESS_EXPIRES_IN` | `apps/api` | No | `'15m'` (per `AuthService.issueTokens`) | jsonwebtoken duration string. |
| `JWT_REFRESH_EXPIRES_IN` | `apps/api` | No | `'7d'` (per `AuthService.getRefreshTokenExpiryDays`) | Whole-day values only (`/^(\d+)d$/`) — the refresh token itself is a random opaque string hashed into the database, not a second JWT, so there is no `JWT_REFRESH_SECRET`. |
| `API_SERVICE_TOKEN` | `apps/web` (server-side only) | Recommended | falls back to an unauthenticated/service-degraded mode if unset — see `lib/api.ts`'s own doc comment | The frontend's own service-account bearer token for Server Component data fetching, used as a fallback beneath a real logged-in user's own session cookie. Never sent to the browser. |
| `WORKER_SERVICE_USER_EMAIL` | `apps/worker` | No | `worker-service@7fifteencapital.com` (per `docker-compose.yml`) | The email of the seeded service account `apps/worker` signs its own internal service tokens as — see `db:seed:service-account`. |

## Frontend (`apps/web`)

| Variable | Used by | Required | Default | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `apps/web` (browser AND server) | No | `http://localhost:4000/api/v1` | Exposed to the browser bundle (`NEXT_PUBLIC_` prefix) — do not put secrets in variables with this prefix. |

## Worker / Queue

| Variable | Used by | Required | Default | Notes |
|---|---|---|---|---|
| `INTERNAL_API_BASE_URL` | `apps/worker` | Yes, if the worker needs to call back into the API | `http://api:4000/api/v1` (docker-compose default) | |
| `QUEUE_DASHBOARD_ENABLED` | `apps/worker` | No | `true` (docker-compose default) | Toggles the Bull Board-style queue dashboard. |
| `QUEUE_DASHBOARD_USER` / `QUEUE_DASHBOARD_PASSWORD` | `apps/worker` | Recommended if the dashboard is enabled | `admin` / empty | Basic-auth credentials guarding the dashboard — an empty password is a real, insecure default; set one in any environment reachable outside localhost. |
| `LOG_LEVEL` | `@7f/logger`, imported by both `apps/api/src/main.ts` and `apps/worker/src/main.ts` | No | package default | |
| `LOG_PRETTY` | same | No | package default | Pretty-prints logs for local development; leave unset/false in production for structured JSON logs. |

## Email (worker-sent notifications)

| Variable | Used by | Required | Default | Notes |
|---|---|---|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` | `apps/worker` | Required for any environment that actually sends email | host/user/password empty; port `587`; secure `false` (docker-compose defaults) | |
| `MAIL_FROM_ADDRESS` | `apps/worker` | No | `no-reply@7fifteencapital.com` | |

## Third-party integrations (`Release IA` provider registry)

These are `ProviderCredential` **row lookups**, not raw secrets read
directly by application code — each `*_PROVIDER_ID` variable is the id of
a row in the integration registry whose own encrypted credential payload
is decrypted using `INTEGRATION_ENCRYPTION_KEY` below. The `TWILIO_*` and
`WHATSAPP_CLOUD_*` variables are the one exception: they're read directly
by their own provider driver, not via a registry row.

| Variable | Provider | Required |
|---|---|---|
| `INTEGRATION_ENCRYPTION_KEY` | all — decrypts every provider's stored credential | **Yes**, in any environment using ANY integration below |
| `POWER_BI_PROVIDER_ID` | Power BI embedding | Only if Power BI is used |
| `BANK_MONO_PROVIDER_ID` | Mono (bank data) | Only if bank integration is used |
| `EMAIL_SMTP_PROVIDER_ID` | SMTP provider registry entry | Only if used via the registry path rather than the direct `SMTP_*` vars above |
| `PAYMENT_FLUTTERWAVE_PROVIDER_ID` / `PAYMENT_PAYSTACK_PROVIDER_ID` | Payment gateways | Only if payments are used |
| `SIGNATURE_ADOBE_SIGN_PROVIDER_ID` / `SIGNATURE_DOCUSIGN_PROVIDER_ID` | Digital Signature Providers | Only if e-signature is used |
| `SMS_TWILIO_PROVIDER_ID` | Twilio SMS | Only if SMS is used |
| `WHATSAPP_CLOUD_PROVIDER_ID` | WhatsApp Cloud API | Only if WhatsApp is used |
| `STORAGE_DRIVE_PROVIDER_ID` / `STORAGE_S3_PROVIDER_ID` | Cloud storage drivers | Only if `STORAGE_DRIVER` selects one of these (see below) |
| `WORKSPACE_ADMIN_PROVIDER_ID` | Google Workspace admin | Only if used |

| Variable | Used by | Notes |
|---|---|---|
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Twilio driver directly | Not read via the provider-id/registry path. |
| `SMS_TWILIO_WEBHOOK_URL` | Twilio inbound webhook registration | |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` / `WHATSAPP_CLOUD_PHONE_NUMBER_ID` / `WHATSAPP_CLOUD_APP_SECRET` / `WHATSAPP_CLOUD_VERIFY_TOKEN` | WhatsApp Cloud driver directly | Same — direct env read, not the registry path. |

## Storage

| Variable | Used by | Required | Default | Notes |
|---|---|---|---|---|
| `STORAGE_DRIVER` | `apps/api` | No | local-disk driver | Selects which storage driver `StorageController`'s single file-serving route uses. |
| `STORAGE_LOCAL_PATH` | `apps/api` | Only if `STORAGE_DRIVER` selects local disk | container-relative path | Maps to the `./storage` volume mount in `docker-compose.yml`. |

## Docker Compose–level variables

These configure the containers themselves (ports, Postgres credentials,
backup schedule) rather than being read by application code directly —
set them in the same `.env` file `docker-compose.yml` already loads via
`env_file: .env` for every service.

| Variable | Default | Notes |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `ledgeros` / `change_me_locally` / `ledgeros` | **Change the password default before any non-local deployment** — it's a real, insecure, checked-in default. |
| `POSTGRES_PORT` | `5432` | Host-side port mapping only. |
| `REDIS_PORT` | `6379` | Host-side port mapping only. |
| `WORKER_HTTP_PORT` | `4100` | The worker's own health-check/dashboard port. |
| `WEB_PORT` | `3000` | |
| `BACKUP_RETENTION_DAYS` | `30` | Consumed by `scripts/backup.sh` via the `backup` compose service. |
| `BACKUP_INTERVAL_SECONDS` | `86400` (24h) | Same. |
| `BACKUP_S3_BUCKET` | *(unset — local-only)* | Optional. If set, `scripts/backup.sh` uploads each dump to `s3://<this bucket>/<same filename>` after the local `pg_dump` succeeds, via the `aws` CLI — confirmed directly in the script, not installed by the `backup` compose service's own `postgres:16-alpine` image, so it silently skips the upload (logging that it did) if set without the CLI present. This is the built-in way to satisfy `deployment-guide.md`'s own "point `BACKUP_DIR` at durable, off-host storage" production recommendation without a separate volume-mount setup. Requires AWS credentials (e.g. `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, not listed here — provided to the `backup` service the same way any other AWS-SDK-consuming process would expect, not a 7F LedgerOS-specific variable). |

---

## Getting started locally

```bash
cp .env.example .env
# edit .env — at minimum set a real POSTGRES_PASSWORD and
# INTEGRATION_ENCRYPTION_KEY if you'll touch any integration
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:seed:service-account
pnpm dev
```

`pnpm docker:up` / `pnpm docker:down` start and stop the full Postgres +
Redis + api + worker + backup + web stack via `docker-compose.yml`,
using the same `.env` file.
