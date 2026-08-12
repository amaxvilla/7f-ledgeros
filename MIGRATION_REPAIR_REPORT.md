# 7F LedgerOS — Foundational Prisma Migration Repair Report

**Date:** 2026-08-09
**New migration:** `prisma/migrations/20260726120000_init_foundational_schema/migration.sql`
**Status:** Repository-side repair complete. No database was touched, queried, or modified.

---

## 1. Original problem

The migration chain in `prisma/migrations/` began at `20260726130000_phase2_rls_access_grants`,
which creates `user_department_access`, `user_cost_center_access`, and `user_project_access`
— all of which reference foundational tables (`users`, `departments`, `cost_centers`,
`projects`, etc.) that no migration ever created. The 58 existing migrations create 57
tables and 61 enums in total; `baseline_full.sql` contains 217 tables and 145 enums. There
was no migration corresponding to the base schema the rest of the chain depends on.

## 2. Root cause identified during audit

`baseline_full.sql` is not a "pre-migration" snapshot — it is a full `pg_dump`-style
snapshot of the **current, final** database schema (post all 58 migrations). This was
confirmed two ways:

- Every one of the 57 tables created by the 58 existing migrations also appears in
  `baseline_full.sql`, with zero exceptions.
- Every one of the 61 enums created by the 58 existing migrations also appears in
  `baseline_full.sql`, with zero exceptions.

So the correct foundational migration is: **everything in `baseline_full.sql` that is not
already created by one of the 58 existing migrations** — not the full baseline file.

## 3. Method

1. Converted `baseline_full.sql` from UTF-16LE (its actual encoding) to UTF-8 for processing.
2. Wrote a SQL statement splitter that respects parenthesis nesting, quoted string
   literals, and `--` line comments (an early version mis-split on a semicolon that
   appeared inside prose inside a comment — caught and fixed before generating output).
3. Parsed `baseline_full.sql` and all 58 `migration.sql` files into typed statements:
   `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` / `CREATE UNIQUE INDEX`,
   `ALTER TABLE ... ADD CONSTRAINT` (PK/FK/unique), and `ALTER TABLE ... ADD COLUMN`.
4. Computed the foundational set as baseline objects whose name does not appear among
   the equivalent objects created by the 58 existing migrations (tables/enums/indexes/
   constraints all matched by exact name — Postgres constraint and index names are
   unique within the schema, so name-matching is exact and safe).
5. For tables that later migrations extend with `ADD COLUMN`, stripped those specific
   columns back out of the foundational `CREATE TABLE` body (see §5) — otherwise the
   later migration's `ADD COLUMN` would fail against a column that already exists,
   since baseline's `CREATE TABLE` already reflects the column having been added.
6. Ran four ordering/hazard checks (§6) before assembling the file.
7. Assembled the migration in dependency-safe order: enums → tables → indexes →
   foreign keys/constraints — mirroring Prisma's own generated ordering.
8. Validated the result with `pglast` (a real PostgreSQL grammar parser) — **parsed
   without error, 762 statements** — and by simulating the entire 59-migration chain
   in order and checking for name collisions across every table, enum, index, and
   constraint.

No database was connected to, queried, or modified at any point — this was static
text/SQL analysis against the repository contents only.

## 4. What's included in the foundational migration

| Object type | Count |
|---|---|
| Tables | 160 |
| Enums | 84 |
| Indexes (regular + unique) | 187 (102 regular + 85 unique) |
| Constraints (PK + FK) | 331 |

**160 foundational tables** include: `users`, `entities`, `departments`, `cost_centers`,
`projects`, `roles`, `permissions`, `accounts`, `journal_entries`, `budgets`, `employees`,
`payroll_runs`, `vendors`, `customers`, `stock_items`, `workflow_definitions`, and 145 more
spanning finance/GL, HR, procurement, inventory, workflow, and RE support tables. Full list
is in the migration file itself (grep `-- CreateTable`).

**84 foundational enums** include `AccountType`, `JournalEntryStatus`, `EmploymentStatus`,
`BudgetStatus`, `PaymentMethod`, `WorkflowInstanceStatus`, and 78 more.

## 5. Columns excluded (already added by later migrations)

Because `baseline_full.sql` reflects the *final* schema, its `CREATE TABLE` definitions
for these 10 foundational tables already include columns that a later migration adds via
`ALTER TABLE ADD COLUMN`. Those specific columns were removed from the foundational
`CREATE TABLE` so the later migration can add them without a duplicate-column error:

| Table | Columns excluded (added later by) |
|---|---|
| `users` | `passwordChangedAt`, `failedLoginAttempts`, `lockedUntil` *(security_hardening)*; `mfaEnabled`, `mfaSecret`, `mfaEnrolledAt` *(mfa_totp)*; `phone` *(sms_twilio)* |
| `refresh_tokens` | `ipAddress`, `userAgent`, `deviceId`, `lastUsedAt` *(session_mgmt_trusted_devices)* |
| `entities` | `businessUnitId` *(phase2_business_unit_dimension)* |
| `notifications` | `bodyHtml` *(email_template_engine)*; `providerMessageId`, `deliveredAt` *(sms_twilio)* |
| `interviews` | `calendarProviderCode`, `calendarEventId`, `calendarSyncFailedAt` *(calendar_sync + visibility)*; `teamsProviderCode`, `teamsMeetingId`, `teamsJoinUrl`, `teamsSyncFailedAt` *(teams_sync + visibility)* |
| `candidates` | `contactProviderCode`, `providerContactId`, `contactSyncFailedAt` *(contact_sync)* |
| `employees` | `directoryProviderCode`, `directoryUserId`, `directorySyncFailedAt` *(directory_sync)* |
| `corrective_actions` | `taskProviderCode`, `providerTaskId`, `taskSyncFailedAt` *(task_sync)* |
| `offers` | `signatureProviderCode`, `signatureProviderEnvelopeId`, `signatureSyncFailedAt` *(offer_letter_sync)* |
| `ar_invoice_lines` | `vatRate`, `vatAmount`, `vatAuthorityAccountId` *(ar_output_vat)* |

The corresponding foreign keys on those columns (e.g.
`entities_businessUnitId_fkey`, `ar_invoice_lines_vatAuthorityAccountId_fkey`,
`refresh_tokens_deviceId_fkey`) were likewise excluded from the foundational migration's
constraint set, since the later migrations that add the column also add its FK.

## 6. Ordering / hazard checks performed (all clear)

| Check | Result |
|---|---|
| Foundational FK referencing a table only created by a *later* migration | 0 found |
| Foundational table column using an enum type only created by a *later* migration | 0 found |
| Foundational index defined on a table only created by a *later* migration | 0 found |
| Foundational FK/constraint whose *own* table is only created by a *later* migration | 0 found |

## 7. Validation performed

- **Static SQL parser (`pglast`, real PostgreSQL grammar):** foundational migration
  parses cleanly — 762 statements, no syntax errors.
- **Structural checks on the generated file:** parentheses balanced (net depth 0,
  never negative), zero double-commas, zero dangling commas before a closing paren.
- **Full-chain collision simulation:** parsed the foundational migration together with
  all 58 existing migrations, in chronological order, and checked every `CREATE TABLE`,
  `CREATE TYPE`, `CREATE INDEX`/`CREATE UNIQUE INDEX`, and `ADD CONSTRAINT` name across
  all 59 files combined.
  - **Table overlap: 0** (217 total, every name appears exactly once)
  - **Enum overlap: 0** (145 total, every name appears exactly once)
  - **Constraint overlap: 0** (517 total, every name appears exactly once)
  - **Index overlap: 0** (321 total named indexes across the full chain; see note below)
  - **Forward foreign-key references: 0** (see §6)

No PostgreSQL server was reachable or used for this validation — per your instructions,
this is static, repository-side analysis only.

### Note on index count (non-blocking, pre-existing)

The full migration chain creates 321 named indexes, while `baseline_full.sql`'s final
snapshot contains 316. The 5-index difference is pre-existing in your *existing*
migrations, not introduced by this repair:

```
entities_businessUnitId_idx
user_business_unit_access_businessUnitId_idx
user_cost_center_access_costCenterId_idx
user_department_access_departmentId_idx
user_project_access_projectId_idx
```

These are single-column FK indexes created by earlier migrations that appear to have
been superseded by composite/unique indexes in later migrations, and are absent from
the current live schema. This does **not** cause any collision and required no change
to any existing migration — flagged here for visibility only, per "do not modify later
migrations unless a dependency requires it."

## 8. What was NOT touched

- No existing migration was modified, renamed, or reordered.
- No migration timestamps were changed.
- `prisma/schema.prisma` was not modified.
- No application code, module, or business logic was touched.
- No second foundational migration was created.
- No database was accessed, migrated, reset, or dropped.
- `migration_lock.toml` is untouched.
