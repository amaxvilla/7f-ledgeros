# 7F LedgerOS — Release Notes

## How this document is organized

This repository's history is a long, continuous chain of checkpoints (recorded
in full, checkpoint-by-checkpoint, in `CHECKPOINT_REPORT.md`) rather than a
series of dated, versioned releases with real commit timestamps. These notes
group that history into logical milestones — what capability area shipped,
not when — and are meant to be read alongside `CHECKPOINT_REPORT.md` (the
complete, granular record) rather than as a replacement for it. No dates are
given anywhere in this document; inventing them would imply a precision this
repository's own history doesn't have.

Each milestone below names what shipped and, where relevant, a real
limitation or deferred piece of it — the same "don't smooth over a known gap"
discipline every other guide in `docs/` already follows.

---

## Backend foundation

The backend (`apps/api`, `apps/worker`) was already substantially complete
before frontend work began under this session's own roadmap framing: Financial
Core (GL, AP/AR, procurement, budgeting, treasury, bank reconciliation,
revenue recognition), Real Estate (land bank, CRM, reservations, mortgages,
handover, tenant/lease/facility management), HRMS, PMO, Security Hardening
(MFA, sessions, IP restrictions, password policy), Fixed Assets, Tax, and a
wide set of Enterprise Integrations (Microsoft Graph, Google Workspace,
SMS/WhatsApp, Paystack/Flutterwave/Mono, Power BI, API Gateway, digital
signatures). 212 Prisma models, 135 enums (see `docs/environment-configuration.md`
for how this was independently re-counted, correcting a stale README claim of
157/81).

## Application Shell

Layout, top navigation (now 50 links), responsive mobile collapse, footer,
per-page breadcrumbs, a Notifications header widget (self-service
mark-read/mark-all-read), and a plain-text user-profile email indicator
(decoded from the access token — no full profile page exists; see
"Known gaps" below). Search and a Theme (light/dark) toggle were both
investigated and explicitly deferred: Search has no backend index/query
surface anywhere in this API, and a real Theme toggle would need `tokens.ts`'s
entire single-static-palette architecture converted to a
ThemeProvider/CSS-variable scheme first — both real, scoped follow-ups, not
built here.

## Dashboards

Executive, Finance (the root `/` dashboard — budget vs. actual, AR/AP
position, cash forecast, bank reconciliation status, project variance),
Treasury, PMO, Real Estate, HR, CRM, and HSE dashboards. PMO's own dashboard
needed a dedicated project-selector component built first (`pmo-analytics`'s
`projectId` is required, unlike every other analytics endpoint's optional
one) — that selector is now a shared pattern reused by other project-scoped
pages (e.g. Project Tasks).

## Finance modules

General Ledger (with Chart of Accounts and Journal Entries folded into the
same page), Dimensions, Budgeting, Procurement, Inventory, Accounts
Payable/Receivable (including Payment Vouchers and Payment Batches — the
latter has no `GET` route of any kind on its backend, so its own UI is
necessarily ID-entry-driven rather than a browsable register), Treasury,
Bank Reconciliation, Fixed Assets, Revenue Recognition, and Tax.

## Real Estate

Land Bank, Projects/Sales (including an installment-schedule builder), CRM,
Mortgage, Handover (full lifecycle: schedule → inspect → snags →
complete/cancel, with the revenue-recognition posting step reusing
`RevenueRecognitionService` rather than duplicating it), Lease, and Facility
Management.

## PMO

Project Tasks (the real `ProjectTask` CRUD and scheduling surface — distinct
from a same-named but unrelated Microsoft/Google Tasks *sync* integration,
confirmed directly rather than assumed from the controller name), Risk
Register, Issue Register, BOQ, Work Packages (including certificate
generation), and the PMO Dashboard.

## Security

Login, MFA enrollment, session management, trusted devices, Login History,
and self-service Change Password all ship on `/my-security`. **Roles**
(`/roles`) and **Users** (`/users`) exist as real, working admin surfaces —
role creation, a full permission checklist per role, and full role
reassignment per user — closing what an earlier checkpoint in this history
had found and documented as a genuine gap (no route anywhere to assign a
permission to a role, or a role to a user). API Keys are managed on
`/api-gateway`.

## Enterprise Integrations

A single unified `/integrations` registry page spans most of this stage's
own named items at once (Microsoft Graph, Google Workspace, SMS, WhatsApp,
Power BI, Digital Signatures, and more) — connector configuration and health
checks, not a separate page per category. Payments, Bank APIs, and Digital
Signatures additionally have their own dedicated domain pages
(`/payments`, `/bank-integration`, `/signatures`) for their own transaction
data. Power BI additionally has real report embedding via the official
`powerbi-client` SDK — the first (and, as of this document, only) third-party
runtime dependency added to `apps/web`, a deliberate exception to this app's
otherwise dependency-free-where-possible default (see `PowerBiEmbed.tsx`'s
own doc comment).

## Administration

Entities, Feature Flags, Workflow Administration (approval-chain template
CRUD), Notification Administration (including delivery stats), Job Queue
(job triggers, including on-demand report generation, plus a full job-run
history table with result-download links), and the Integration Management
surface named above. **System Configuration** and **Environment Settings**
were both investigated and confirmed to have no backend capability of any
kind to build a UI against — not frontend gaps, and out of scope for
"only add backend code if a verified frontend dependency is missing."

## Reports

A `/reports` hub (Vendor/Customer Aging, Project Profitability, Bank
Reconciliation Summary, Cash Forecast, Fixed Asset Register, Payment
Transactions Register, Mono Linked Accounts Register) and `/financial-statements`
(Profit or Loss, Financial Position, Cash Flows, Comprehensive Income,
Changes in Equity — the five primary IFRS statements), the latter with real
CSV export and browser print support. **Saved Reports** and **Scheduled
Reports** were both investigated and confirmed to have zero backend support
anywhere (no model, no scheduler/cron primitive) — genuinely new backend
work, not attempted here.

## Frontend Parity follow-ups

`DataTable`, the single most-reused component in this app (~50 call sites),
gained opt-in pagination, search, filters, and an opt-in bulk-actions
primitive (checkboxes + selection state + a caller-supplied action bar,
demonstrated once on `/entities`'s deactivate action — a real, working
client-side-fan-out shape, not a generic backend batch endpoint, since no
such endpoint exists anywhere in this API). Each shipped as a shared-primitive
addition plus exactly one real, justified demonstration site — deliberately
not retrofit across every call site at once.

## Enterprise UX

A shared `Toast` notification system (Context + a fixed-position stack, no
third-party library). A systematic accessibility/mobile-responsiveness pass
closed out two large, separately-tracked populations of undersized `Button`/
`TextField`/`Select` touch targets across dozens of files app-wide (dynamic
line-item "+ Add"/"Remove" controls, and per-row `DataTable` action buttons),
along with real form-validation and empty/loading/error-state coverage
audits. A handful of newer pages built after that rollout's original audit
(Power BI, Project Tasks, Integrations) still carry the same pattern and
remain a named, open follow-up.

## Documentation

This `docs/` directory itself: Environment Configuration (every variable
this monorepo reads, `.env.example`, and a `.gitignore` that didn't exist
before it), a Deployment Guide, an API Guide (including a measured finding
that zero controllers use `@ApiOperation`, so Swagger's per-route
descriptions are auto-inferred and not to be trusted at face value), an
Administrator Guide (corrected this session: role↔permission and
user↔role assignment both now have real, working full-replace routes
and forms — `PUT /roles/:id/permissions`/`RolePermissionsForm` and
`PUT /users/:id/roles`/`UserRolesForm`, re-verified directly against
both controllers, not assumed from the guide's own prior text), User
Guides for Finance and HSE (other module families remain undocumented —
see below), and Operational Runbooks
(health checks, backups/restores, the queue dashboard's own real auth model,
and a genuine, previously-undocumented bug: the API's own `/metrics`
endpoint emits `worker_`-prefixed metric names for its own traffic, with no
`api_*`-prefixed metrics existing anywhere — named plainly, not fixed, since
fixing it means redesigning metric names/labels, a real decision outside a
documentation-only stage).

---

## Production Hardening

Interactive Swagger documentation (`@ApiOperation` summaries/descriptions)
is complete across every controller in `apps/api` — the last apparent
gaps were confirmed to be a survey-script false positive (a doc-comment
that happened to contain route-decorator-looking text) and four
webhook controllers whose routes are deliberately excluded from the
Swagger surface via `@ApiExcludeEndpoint()`, not real gaps. Both `api`
and `worker` expose the same three-endpoint health shape
(`/live`, `/ready`, `/health` — see `docs/deployment-guide.md`'s "Health
checks" section) with real Postgres/Redis checks, not stubs, and are
wired into `docker-compose.yml`'s own container health checks. A CI
pipeline (`.github/workflows/ci.yml`) now runs install, Prisma-client
generation, lint, typecheck, test, and build on every push/PR against
`main` — the first one in this repository's history; see
`docs/deployment-guide.md`'s "Continuous Integration" section for its
exact scope and the reasoning behind not yet starting a database
service container in it.

## Known gaps and deferred work

Recorded here plainly, matching every guide in this directory's own
practice of naming a limitation rather than smoothing over it:

- **No generic User Profile page.** The header shows only the email decoded
  from the access token; a full profile page needs a new backend endpoint
  that doesn't yet exist (`GET /hr/me/profile` only works for accounts
  linked to an HR Employee record, not universally).
- **RBAC-provisioning UI: CLOSED, this correction.** Earlier drafts of
  this document (and, until this same pass, `docs/administrator-guide.md`)
  described role↔permission and user↔role assignment as unavailable
  through the UI. Re-verified directly against both `RolesController`
  and `UsersController`: `PUT /roles/:id/permissions` and
  `PUT /users/:id/roles` are both real, working, full-replace routes,
  each with a real form (`RolePermissionsForm`, `UserRolesForm`) on the
  relevant detail page. What's still outside the UI is narrower than
  previously stated: creating the permission catalog itself and the
  very first role/user for a fresh install remain seed-data/direct-
  database concerns, not a day-to-day administration gap. This entry is
  kept (rather than deleted) so a reader who remembers the old claim can
  see it was checked and corrected, not silently dropped.
- **Search and Theme (light/dark)** remain unbuilt at the Application Shell
  level, both for real, named reasons above.
- **User Guide coverage is partial** — only Finance and HSE have their own
  guide today; Real Estate, PMO, HR, Security, Enterprise Integrations, and
  Administration are all real, separate, unwritten slices.
- **Saved Reports, Scheduled Reports, System Configuration, and Environment
  Settings (as an admin UI)** all have no backend capability to build
  against — confirmed by direct inspection, not assumed.
- **`DataTable`'s bulk-actions primitive** has one real demonstration site
  (`/entities`) and was deliberately not retrofit elsewhere.
- **A handful of newer pages** (Power BI, Project Tasks, Integrations) still
  carry the compact touch-target pattern the Mobile Responsiveness rollout
  otherwise closed out everywhere else.
- **The `@ApiOperation` gap** — zero controllers across the whole API use
  it, so Swagger's per-route descriptions are Nest's own auto-inferred
  defaults, not hand-written prose.
- **A real, unfixed bug**: the API's own `/metrics` endpoint emits
  `worker_`-prefixed names for its own traffic; no `api_*`-prefixed metrics
  exist. A genuine Production Hardening (Stage FC-6) candidate.
- **`apps/api`'s own `tsc --noEmit`** has not been independently re-run at
  any point in this session's own checkpoint history — every verification
  pass recorded here scoped to `apps/web`/`packages/ui` only. Worth a
  dedicated pass before Stage FC-6 relies on backend type-safety being
  clean.
