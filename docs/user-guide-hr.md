# User Guide — HR

Stage FC-5 (Documentation). Seventh module-family slice of the User
Guide, per FC-5.11's own recommendation. Confirmed directly against the
current repository (`apps/web/app/hr/`, `apps/web/app/recruitment/`)
that every component named below exists as described — read fresh this
checkpoint, not assumed from this document's own earlier module-family
slices.

**Read this first:** the frontend's own "HR" surface is smaller than
the backend behind it. `apps/api/src/hr-payroll/` has nine controllers
— Employee Lifecycle, Attendance, Leave, Performance, Succession,
Training, Self-Service, and Payroll itself, alongside HR Analytics —
but only HR Analytics (as the dashboard below) and Recruitment have any
page in this app today. There is no employee record page, no leave
request page, no performance review page, no payroll run page, and so
on — none of that is reachable through this application's UI yet, even
though the backend supports it. This guide documents the two pages that
exist; it doesn't describe the rest of the backend as if a page for it
were coming, since none is confirmed planned.

## HR Dashboard

`/hr` — pick an entity to see a single executive summary: headcount
(total, and broken down by department, employment type, and gender),
turnover rate, attendance (present/late/absent rates), the recruitment
funnel (applications by stage, hire rate), monthly payroll cost, and
training completion. Everything here comes from one backend call
(`GET /hr/analytics/executive-summary`) — there's no drill-down from
this dashboard into an underlying employee list or attendance record,
since no such page exists in this app.

The department table on this page merges two separate backend figures
(headcount by department, payroll cost by department) into one row per
department — a display convenience, not a sign of a combined backend
endpoint. Gender and employment-type breakdowns are in the underlying
data but aren't rendered as their own table on this page today.

## Recruitment

`/recruitment` — the one part of HR with a full read-write UI: job
requisitions, vacancies, and the applications pipeline behind them,
plus a dashboard of its own (open vacancies, pending requisitions,
upcoming interviews, and the sync-failure counts described below).

**Job requisitions** — create one (`CreateRequisitionForm`) with a job
title, headcount, employment type, and optional department/cost
center/project/budget-line references. A requisition moves through its
own small lifecycle with row actions that appear only when they'd
actually do something:

- **Submit** — only while still a Draft.
- **Refresh approval** — only once submitted and still awaiting a
  decision; this checks in on an approval workflow already in
  progress, so it disappears again once that workflow resolves.
- **Close** — available at any stage except once already Closed,
  including abandoning a requisition that was never submitted. Unlike
  the vacancy actions below, closing a requisition has no backend
  status restriction of its own; the button is simply hidden once
  there's nothing left to close.

**Vacancies** — create one (`CreateVacancyForm`) against an *approved*
requisition (the requisition picker only offers approved ones — the
backend itself would reject any other status). Row actions:

- **Publish** — only from Draft or On Hold.
- **Mark filled** / **Close (unfilled)** — two separate buttons, only
  offered while Open or On Hold, covering the two outcomes a closed
  vacancy can have. There's no single "Close" action with a follow-up
  choice — you pick the outcome directly.

**Needs attention: sync failures** — a section with four
independent lists (calendar sync, Teams sync, contact sync, signature
sync), each row backed by its own **Retry** button. A repeated failure
on retry is a real possibility (the backend rejects a second
consecutive failure with its own error), and the row simply stays with
that error shown rather than being hidden or specially handled. A
successful retry clears the row on its own — you don't need to refresh
manually. The **Sync failures** KPI figure near the top of the page
covers only calendar and Teams sync (confirmed against the backend's
own query); contact-sync and signature-sync failures are tracked in
their own list sections but were never counted in that KPI, so don't
expect the top-line number to move when you resolve one of those two.

## What's not here yet

Worth knowing going in, since it's easy to assume an ERP's "HR" module
covers more than this one currently does: **Employee Lifecycle**
(records, onboarding, confirmation, disciplinary cases, exits),
**Attendance** (shifts, rosters, clock-in/out, biometric devices),
**Leave**, **Performance** (reviews), **Succession** (planning), and
**Training** all have real, working backend APIs — this guide isn't
describing an empty shell — but none of them has a page in this
application today. If you need any of that functionality, it exists
at the API level; there's no UI path to it yet. Recruitment and the HR
Dashboard, described above, are the whole of what's currently
reachable by a user of this app.
