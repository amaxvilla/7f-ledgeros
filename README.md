# 7F LedgerOS

Multi-entity financial operating system for **7Fifteen Capital Ltd** — a single-database,
dimension-based accounting engine built for real estate developers, construction companies,
investment SPVs, and holding companies.

This repository implements the **Financial Kernel** (entity management, global chart of
accounts, dimension engine, general ledger/posting engine, intercompany engine, consolidation
engine) plus the modules that build on it: **Real Estate**, **Revenue Recognition**,
**Inventory**, **PMO & QS**, **Treasury**, **HR & Payroll**, **HSE**, **Accounts Payable**,
**Accounts Receivable**, **Procurement**, **Budgeting**, **Bank Reconciliation**,
**Recruitment**, **Workflow** (approval engine used across modules), **Reporting**,
**Dashboard**, **Admin/Branding**, **Storage**, and **Integrations** (Release IA — a
provider registry with encrypted credential storage that later releases build concrete
drivers on top of: cloud storage, email, SMS/WhatsApp, payments, banking, and more).

> The module list above reflects the codebase as of this audit. Earlier revisions of this
> README described only the original "Phase 1" module set — several modules (AP, AR,
> Procurement, Budgeting, Bank Reconciliation, Recruitment, Workflow, Reporting, Dashboard)
> were added afterward without a corresponding README update. If you add or remove a module,
> update this list in the same change.

---

## Architecture

- **One PostgreSQL database** serves every legal entity in the group.
- Every `JournalLine` carries a full set of dimension foreign keys (entity, project, phase,
  block, floor, unit, department, cost center, funding source, vendor, customer) so a single
  transaction table answers questions at any level of granularity without duplicating data.
- The **Posting Engine** (`apps/api/src/general-ledger/posting-engine.service.ts`) is the only
  path by which a journal entry becomes `POSTED`. It enforces, inside one DB transaction:
  balanced debits/credits, an open fiscal period, activated/postable accounts, atomic
  gap-free journal numbering, an audit log row, and a `journal.posted` domain event.
- **Intercompany** transactions create a journal entry on the initiator's books and an
  automatic mirror entry on the counterparty's books, linked for reconciliation.
- **Consolidation** groups roll posted lines up across member entities, net eliminations,
  and produce a consolidated trial balance, P&L, and balance sheet.
- **Real Estate** models Estate → Project → Phase → Block → Floor → Unit, unit sale
  allocation, installment schedules, and customer statements.
- **Revenue Recognition** posts the IFRS 15 deferred-revenue pattern: `Dr Bank / Cr Deferred
  Revenue` on customer payment, then `Dr Deferred Revenue / Cr Property Sales Revenue` +
  `Dr Cost of Sales / Cr Property Inventory` on handover — both auto-posted through a new
  `PostingEngineService.postSystemEntry()` path built for automated subsystems (also usable
  by payroll, bank imports, etc.) that skips the human maker/checker step but keeps every
  other kernel validation (balance, open period, activated accounts, audit log, domain event).
- **Inventory** maintains a weighted-average cost per stock item per warehouse across goods
  receipts, material issues, stock transfers, and stock counts, with an append-only
  `StockMovement` ledger backing the running `StockBalance`.
- **PMO & QS** implements the BOQ → Work Package → Progress Valuation → Interim Payment
  Certificate chain with a shared `Draft → Reviewed → Approved → Certified` workflow guard
  (one step at a time, no skipping, certified documents can't be rejected). IPC arithmetic
  follows the standard construction pattern — retention held back per certificate, net
  payable calculated against cumulative prior certificates. Certifying an IPC rolls its
  retention into a running `Retention` record with its own release tracking. Variation
  orders and a simplified final-account roll-up complete the module.
- **Treasury** covers bank/cash accounts, loan facilities with drawdown-against-facility-limit
  enforcement, a flat-interest repayment schedule generator, repayment recording with
  partial-payment tracking, interest accruals, and investment placements with maturity
  processing (payout, or rollover principal / principal+interest into a fresh placement).
- **HR & Payroll** calculates payslips (gross pay, Nigerian-style pension 8%/10%
  employee/employer, 2.5% NHF, and progressive PAYE net of Consolidated Relief Allowance)
  for every active employee with a salary structure, then auto-posts the payroll journal
  through `postSystemEntry()` — the debit side (gross pay + employer pension) balances the
  credit side (every statutory payable + net salaries payable) by construction, since net
  pay is defined as the residual after all deductions.
- **HSE** covers incident reports and near misses (with a guard that blocks closing an
  incident until its corrective actions are COMPLETED), PPE issuance with expiry tracking,
  toolbox talks, corrective actions with overdue-flagging, and inspection checklists whose
  overall PASS / PASS_WITH_OBSERVATIONS / FAIL result is derived from its item-level
  compliance once every item has been assessed.

---

## Repository layout

```text
7f-ledgeros/
├── apps/
│   ├── web/                   # Next.js frontend — 50+ route segments across every
│   │                           #   module (Finance, Real Estate, PMO, Security,
│   │                           #   Administration, Enterprise Integrations, Reports)
│   ├── api/                   # NestJS backend — Financial Kernel lives here
│   └── worker/                 # Background jobs (BullMQ) — email, dashboard refresh,
│                                #   budget recalculation, report generation, bank
│                                #   statement import; own health/dashboard HTTP server
├── packages/
│   ├── types/                # Shared enums + DTO-shaped interfaces (no Prisma dependency)
│   ├── utils/                 # Shared accounting helpers (currency formatting, balance checks)
│   ├── config/                # Permission registry, default roles, standard account codes,
│   │                           #   JWT secret resolution (shared between apps/api and apps/worker)
│   ├── logger/                 # Shared structured logger (LOG_LEVEL/LOG_PRETTY)
│   └── ui/                    # Shared UI component library (@7f/ui) — DataTable, Form
│                                #   primitives, AppShell/Nav, Toast, PmoStatusActions, etc.
├── prisma/
│   ├── schema.prisma          # Full data model (212 models, 135 enums)
│   └── seed.ts                # Entities, chart of accounts, RBAC, admin user, sample data
├── docker/                    # Dockerfiles for api / worker / web
├── docker-compose.yml         # Postgres + Redis + api + worker + backup + web
├── docs/                      # environment-configuration.md, deployment-guide.md, api-guide.md, administrator-guide.md, user-guide-finance.md, user-guide-hse.md, operational-runbooks.md, release-notes.md, user-guide-pmo.md, user-guide-real-estate.md, user-guide-security.md, user-guide-hr.md, user-guide-enterprise-integrations.md, user-guide-administration.md, user-guide-dashboards-reports.md, further guides (Stage FC-5)
├── .env.example
└── pnpm-workspace.yaml
```

> The counts and descriptions above were re-verified directly against the actual
> repository (`grep`/`find`, not assumed) as of Stage FC-5's own Environment
> Configuration checkpoint. If you add a model, enum, app, or package, update this
> block in the same change — this same block was found significantly stale (claiming
> the frontend was "scaffolding only" and the worker "not yet implemented," and citing
> 157 models/81 enums against an actual 212/135) before that checkpoint corrected it.

---

## Getting started

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@9.4.0 --activate`)
- Docker (for Postgres + Redis locally)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment config and adjust secrets
cp .env.example .env
# see docs/environment-configuration.md for what every variable does,
# which app reads it, and which ones are required in production

# 3. Start Postgres + Redis
pnpm docker:up   # or: docker compose up -d postgres redis

# 4. Generate the Prisma client
pnpm db:generate

# 5. Run migrations
pnpm db:migrate

# 6. Seed entities, chart of accounts, RBAC, and sample data
pnpm db:seed

# 7. Start the API in watch mode
pnpm --filter api dev

# 8. In separate terminals: the frontend and the background worker
pnpm --filter web dev
pnpm --filter worker dev
```

The API listens on `http://localhost:4000`, with Swagger docs at `/api/docs`. The frontend
listens on `http://localhost:3000`. The worker exposes its own health/queue-dashboard HTTP
server on `http://localhost:4100` (see `docs/environment-configuration.md` for
`WORKER_HTTP_PORT`, `QUEUE_DASHBOARD_ENABLED`, and the dashboard's own basic-auth credentials).

Seeded login: `admin@7fifteencapital.com` / `ChangeMe!2026` — **rotate this immediately**,
it exists only to bootstrap the first real admin account.

### Running tests

```bash
pnpm --filter api test      # backend — 155 spec files (grep-verified, Stage FC-5)
pnpm --filter web test      # frontend pages/components
pnpm --filter @7f/ui test   # shared UI component library
```

All three run against hand-rolled Prisma mocks / mocked Server Actions — no live database or
running API is required for any of them. As of Stage FC-5's own verification checkpoint,
`pnpm --filter web test` and `pnpm --filter @7f/ui test` together pass **1378 tests across
156 files** (1194 + 184) with zero TypeScript errors in either package — re-confirmed directly
that same checkpoint, not carried over from an older count. The backend suite's own current
pass/fail count is not restated here to avoid this section going stale the same way its own
prior "71 tests across seven suites" claim did; run `pnpm --filter api test` directly for the
current number.

`apps/web`'s own suite is large enough that a single `vitest run` exceeds this environment's
usual command time budget — shard it if needed: `pnpm --filter web test -- --shard=1/4` (through
`4/4`).

### Full stack via Docker

```bash
pnpm docker:up
```

Brings up Postgres, Redis, the API, the worker, and the web app together.

---

## A note on this environment's validation

Schema changes here were checked structurally (every named Prisma relation pairs correctly,
every compound unique key is referenced consistently, all 330 relation fields across 157
models cross-reference cleanly, parens/braces balanced — verified with scripts, not just by
eye). Full `prisma generate` / `prisma validate` against the live query engine could not be
run in this sandbox because it fetches engine binaries from `binaries.prisma.sh`, which isn't
on this environment's network allowlist — confirmed again during the July 2026 stabilization
pass (every attempt returns `403 Forbidden`). This means:

- `tsc` was run against the *ungenerated* Prisma client (a 1-line empty stub). Every type
  error it reported (missing enums like `WorkflowInstanceStatus`, missing `Prisma.sql`,
  implicit-`any` params on relation-array `.reduce()` calls) was cross-checked against the
  schema and confirmed to be caused entirely by the missing generated types, not a genuine
  code defect. Nothing was "fixed" in code for these, because there was nothing to fix.
- `prisma migrate` (and therefore a real migration history) cannot be produced here either,
  since it needs the same engine. This is the one stabilization item still blocked on your
  environment — see below.

Run `pnpm db:generate` in your own environment before your first migration; it will download
the real engine normally there. Then `pnpm db:migrate` to create the initial migration
history, and `pnpm --filter api test` to run the suite against fully-typed Prisma types.

---

## Security & production configuration

- **JWT access secret**: no fallback in production. If `JWT_ACCESS_SECRET` is unset and
  `NODE_ENV=production`, the API refuses to boot rather than silently using a known default.
- **Integration encryption key**: same rule as the JWT secret above — `INTEGRATION_ENCRYPTION_KEY`
  (any length, SHA-256-hashed into an AES-256-GCM key) must be set in production or the API
  refuses to boot. It encrypts every `IntegrationProvider.encryptedCredentials` blob at rest;
  see `packages/config/src/encryption.ts`.
- **CORS**: unrestricted (reflects any origin) outside production for local-dev convenience.
  In production, `CORS_ORIGINS` (comma-separated allow-list) is required — the API refuses to
  boot without it.
- **Swagger** (`/api/docs`): on by default outside production. In production it's off unless
  `SWAGGER_ENABLED=true` is set explicitly.
- **Refresh tokens**: opaque, cryptographically random, SHA-256 hashed before storage,
  rotated on every use, and individually revocable via the `RefreshToken` table — not JWTs.
  There is deliberately no refresh-token signing secret to configure.

## Deletion / retention policy

Financial and operational history (journal entries/lines, AP/AR, budgets, procurement,
treasury, bank reconciliation, payroll, HR, recruitment, workflow execution history) uses
`onDelete: Restrict` on every foreign key throughout `prisma/schema.prisma` — deleting a
parent record is blocked at the database level while dependent history still references it.
`onDelete: Cascade` is used in exactly ~12 relations, each with an inline comment justifying
it: RBAC join tables (`UserRole`, `RolePermission`), access-grant rows (`UserEntityAccess`),
the chart-of-accounts activation join (`EntityAccount`), session tokens (`RefreshToken`), and
workflow *template* structure (`WorkflowStageDefinition`, `WorkflowApprovalRule` — config, not
execution history). See the policy banner at the top of `prisma/schema.prisma`.

---

## Current status and remaining work

This README covers setup and environment configuration; it deliberately does not try to
enumerate what's built vs. outstanding — that list changes too often to keep accurate here
without it going stale the way an earlier version of this section did (a prior revision
claimed only the frontend and worker apps remained; both are now substantial, tested parts
of this codebase, confirmed directly during Stage FC-5's own Environment Configuration
checkpoint). **`CHECKPOINT_REPORT.md` at the repository root is the maintained, current
source of truth for what's done and what's next** — its own most recent entry always
reflects the latest verified state.

**One specific, still-accurate limitation, independently re-confirmed as recently as Stage
FC-5's own checkpoint**: `prisma generate`/`prisma migrate` fetch engine binaries from
`binaries.prisma.sh`, which returns `403 Forbidden` in network-sandboxed environments (CI
runners or agent sandboxes without that host on their allowlist). This is a sandbox
networking constraint, not a schema-validity concern — run `pnpm db:generate` in a normal
development environment with unrestricted internet access and it resolves normally; see "A
note on this environment's validation" above for how prior checkpoints worked around it when
verifying schema changes without that access.
