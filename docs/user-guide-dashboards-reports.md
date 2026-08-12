# User Guide — Dashboards & Reports

Stage FC-5 (Documentation). Ninth module-family slice of the User
Guide.

**Why this guide exists.** FC-5.14's own report recommended confirming
directly whether every User Guide module family was covered, rather
than assuming the original eight-slice list (Finance, HSE, PMO, Real
Estate, Security, HR, Enterprise Integrations, Administration) was the
whole picture. Re-listing every route under `apps/web/app/` and
cross-checking each one against the eight existing guides found two
real, substantial gaps neither guide's own scope touches at all: the
**Executive Dashboard** (`/executive`) and the **Reports hub**
(`/reports`) — both cross-cutting, aggregate-data pages that don't
belong to any single functional module, which is exactly why they fell
through every module-family slice written so far. A `grep` across
`docs/user-guide-finance.md` for either term returned nothing — that
guide is scoped purely to Finance's own functional pages (AP/AR,
Budgeting, General Ledger, and so on), not dashboards or reports, so
this genuinely isn't a duplicate of anything already written.

A third gap turned up while writing the Reports section below: a
passing cross-reference to `/financial-statements` sent a `grep` across
every existing guide for that page's own name, and it too came back
with zero hits anywhere except `docs/release-notes.md` (a changelog
entry, not user documentation) — a five-statement statutory reporting
page with real CSV export and browser print support, completely
undocumented until now. Genuinely the same shape as the other two —
cross-cutting, doesn't belong to one functional module — so it's
covered here as a third section rather than deferred to its own
checkpoint.

A third, much smaller gap was found the same way: **`/admin-tools`**, a
single-form page with zero mentions anywhere in `docs/`. It's covered
as a short addendum to `docs/user-guide-administration.md` instead of
here — thematically it's an admin-utility page, not a dashboard or
report, and belongs with that guide's own Workflow/Notifications/Queue
material rather than bundled into this one for no reason beyond both
being "things nobody had written down yet."

## Executive Dashboard (`/executive`)

A single composite view built entirely from data every other dashboard
page already surfaces individually — Budget, AR/AP net position, Cash
Forecast, Fixed Assets, Tax — plus two figures that appear nowhere else
in this app: **financial ratios** and **profit or loss**, both scoped
to a specific fiscal period.

Pick an entity to see four top-level KPI cards (net AR−AP position,
budget available, fixed-asset net book value, pending WHT+VAT tax) that
don't need a period at all. Profit or Loss, and the period-scoped half
of Financial Ratios, need a fiscal period id added to the URL
(`?entityId=...&fiscalPeriodId=...`) — there's no picker for this on
the page itself (no fiscal-period picker component exists anywhere in
this app yet), so it has to be typed in directly. Without one, Profit
or Loss shows a note explaining what to add rather than blank or
broken KPI cards, and every Financial Ratios card falls back to "—".

Financial Ratios itself covers eight figures: current ratio, quick
ratio, debt ratio, debt-to-equity, gross margin, operating margin, net
margin, and cash conversion cycle (in days) — sourced from a database
view, not computed in the browser. Two more sections round out the
page: a three-row Cash Forecast table (30/60/90-day horizons) and a
Top Projects by Budget Variance table, both reusing the exact same data
shapes their own standalone pages already use elsewhere in this app.

**Not on this page**: HSE. The dashboard was originally expected to
cover it too, but HSE has no single composite aggregate endpoint the
way every other area here does — its six list endpoints (incidents,
near misses, PPE, toolbox talks, corrective actions, inspection
checklists) would need their own client-side rollup, or a new backend
aggregate, before a tile could be added here. Neither has been built;
HSE's own dashboard (covered in `docs/user-guide-hse.md`) remains the
only place to see that data today.

## Reports (`/reports`)

Eight independent report sections, each backed by its own database view
or endpoint, all gated behind the same entity picker. There's no
fiscal-period selector anywhere on this page — every section here reads
current, unperiod-scoped data (open invoices, current asset balances,
current job status), unlike `/financial-statements`' own period-scoped
reports.

- **Vendor Aging** / **Customer Aging** — one row per open (posted,
  unpaid) invoice, bucketed into current/1-30/31-60/61-90/90+ days past
  due, with KPI totals for open balance, overdue balance, and balance
  90+ days past due. The bucket boundaries are computed by the database
  view itself and kept in sync with the same aging logic AP/AR's own
  register already uses — this page doesn't recompute them.
- **Project Profitability** — one row per project: revenue and cost
  recognized through posted general-ledger journal lines tagged with
  that project (not AR or Procurement subledgers directly, so every
  posted source is captured consistently). Margin shows "—" rather than
  0% when there's no revenue yet, not a divide-by-zero artifact.
- **Bank Reconciliation Summary** — one row per active bank account,
  joined to its own most recent reconciliation session (if any — no
  session yet is a normal, expected state) and that session's still-
  unmatched statement-line count.
- **Cash Forecast** — exactly three rows per entity (30/60/90-day
  horizons). Each horizon's own inflow/outflow figures are
  *cumulative* — every invoice due within that many days, not a
  discrete window — which is why this section has no KPI-card summary
  the way every other one does: summing across the three rows would
  double-count the same invoices. The three-row table already is the
  summary.
- **Fixed Asset Register** — one row per fixed asset, with its category
  and most recent posted depreciation figures. A newly acquired asset
  with no depreciation history yet shows zero accumulated depreciation
  and a net book value equal to its acquisition cost — a normal state,
  not a gap.
- **Payment Transactions Register** — every payment transaction for the
  entity, with one figure `/payments`' own register doesn't have:
  refund-aware net amounts (`total_refunded`/`net_amount`, computed via
  a refunds join that page's own list endpoint never performs). Amounts
  here are converted from minor units (kobo/cents) for display, the
  same local conversion `/payments` itself already uses — nowhere else
  in this app needs it, since every other money figure is already
  stored in major units.
- **Mono Linked Accounts Register** — every linked bank account
  regardless of status, with a few fields `/bank-integration`'s own
  register doesn't show (currency, linked/revoked/reauth-required
  timestamps). The two pages overlap more than the payment pairing
  above does — most of what's here is already visible on
  `/bank-integration`, which also has a working Revoke action this
  read-only register doesn't. Both exist for the same reason the SQL
  views behind them state explicitly: an operational page for acting on
  data, and a statutory-grade register for auditing/exporting all of
  it, sitting side by side rather than one replacing the other.

**What's deliberately not here.** Two report endpoints were
investigated and dropped rather than built into their own sections: a
PMO risk/issue register endpoint turned out to be a thin wrapper around
the exact same aggregate `/project-risks`/`/project-issues` already
show, and a PMO project-performance endpoint turned out to be the exact
data already powering `/pmo`'s own earned-value KPI cards (PV/EV/AC/
SV/CV/SPI/CPI). Building sections for either would just re-render
numbers already visible elsewhere in this app — noted here so their
absence reads as a checked decision, not an oversight.

None of the eight sections above have a status or date filter on this
page yet, even where the underlying endpoint supports one (most accept
an optional `status` query param) — every section fetches every row
and lets its own status badge column communicate the value, the same
"no filter UI until a register is large enough to need one" approach
this app takes elsewhere.

## Financial Statements (`/financial-statements`)

The five primary IFRS statements — Profit or Loss, Financial Position,
Cash Flows (indirect method), Comprehensive Income, and Changes in
Equity — each period-scoped, unlike every section on `/reports` above.
Pick an entity, then a fiscal period; an optional second, comparative
fiscal period adds a side-by-side prior-period column to three of the
five statements (Profit or Loss, Financial Position, Comprehensive
Income — the three built from the same account-line-item shape).

Three statements carry their own built-in integrity check, shown as a
KPI card rather than left for the reader to verify by hand: Financial
Position reports whether it **balances** (assets = liabilities +
equity), Cash Flows reports whether it **reconciles to the ledger**,
and Changes in Equity reports whether its closing balance **reconciles
to the balance sheet**. Each shows "Yes" in a positive tone or "No" in
a warning tone — a "No" is a genuine data-integrity signal worth
investigating, not routine.

**Export and print.** One Print button, shown once near the top of the
page — the browser's own print dialog captures everything currently
visible in a single pass, so there's no need for five separate
buttons. CSV export is per-statement and only on three of the five:
Profit or Loss, Financial Position, and Comprehensive Income (the three
sharing the same line-item shape the export button's own row format
expects). Cash Flows and Changes in Equity have no CSV export yet — the
first is a handful of named summary figures rather than a list of
line items, and the second is a component-by-movement-category grid,
neither shaped like the other three, so exporting either would need
its own dedicated formatting rather than reusing what the other three
already share.

