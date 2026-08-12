# User Guide — PMO

Stage FC-5 (Documentation). Sixth module-family slice of the User Guide,
per FC-5.7's own recommendation. Confirmed directly against the current
repository (`apps/web/app/pmo/`, `project-tasks/`, `project-risks/`,
`project-issues/`, `boq/`, `work-packages/`) that every component named
below exists as described — read fresh this checkpoint, not assumed from
this document's own earlier module-family slices.

`/pmo` — pick an entity and a project (this is the one PMO dashboard
that needs both; every other analytics endpoint in this app makes
`projectId` optional, this one doesn't) to see that project's schedule
performance index (SPI), cost performance index (CPI), and a risk/issue
register summary (counts by status, top open risks by score, open
issues by priority) in one place. An index of "—" means there's nothing
to divide by yet, not zero performance.

## Project Tasks

`/project-tasks` — create a task (`CreateTaskForm`) against a project,
optionally under a parent task (subtasks nest one level). Each task has
two independent row controls: **% complete** (a progress percentage,
disabled once a task is `CANCELLED`) and **Set status** (the five-value
lifecycle — Not Started, In Progress, Completed, On Hold, Cancelled —
which stays available even on a cancelled task, e.g. to move it back to
Not Started). There is no Gantt-chart visualization yet — the dashboard
above consumes the same task/dependency data as a flattened list for its
own schedule-performance calculation, not as a rendered chart.

## Risk Register

`/project-risks` — log a risk (title, description) against a project.
Two families of row action:

- **Owner / Convert to issue** — meaningful at any open stage; assign an
  owner, or convert a risk that has materialized into a real project
  issue (see Issue Register below).
- **Assess / Mitigation plan / Monitor** — the workflow-progression
  trio: score the risk (Probability × Impact, each Low/Medium/High),
  record a mitigation plan, and log a monitoring note. All three (like
  every other row action here) are blocked once the risk is **Closed**.

**Close** is available once a risk no longer needs active tracking.

## Issue Register

`/project-issues` — log an issue directly, or arrive at one via a risk
conversion above. Row actions: **Assign** (a person), **Start work**,
**Escalate**, and **Resolve** (the last of the four opens a small notes
prompt). All four stay available on an already-`Resolved`/`Escalated`/
`In Progress` issue — reassigning a resolved issue, or re-escalating an
already-escalated one, are both real, meaningful actions here, not
blocked the way a fully **Closed** issue's own row is.

## Bill of Quantities (BOQ)

`/boq` — create a Bill of Quantities against a project (`CreateBoqForm`):
line items with descriptions, quantities, and rates. Advances through a
shared four-stage workflow — **Draft → Reviewed → Approved → Certified**
— one step at a time via an Advance/Reject pair of buttons
(`PmoStatusActions`, the same shared component Work Packages,
Certificates, Variation Orders, and Progress Valuations below all
reuse). A rejected BOQ needs correcting and resubmitting; there's no
"skip a stage" shortcut.

## Work Packages

`/work-packages` — create a Work Package (`CreateWorkPackageForm`)
against a project, with its own Draft-through-Certified status lifecycle
(the same shared `PmoStatusActions` as BOQ above). Each work package's
own detail page (`/work-packages/[id]`) is where the real contract-
management workflow lives:

- **Progress Valuations** (`CreateProgressValuationForm`) — record how
  much of the work package's own value has been earned as of a given
  date, with the same Draft → Certified advancement.
- **Variation Orders** (`CreateVariationOrderForm`) — a scope/value
  change against the work package, its own independent status lifecycle.
- **Interim Payment Certificates** (`GenerateCertificateForm`) — a
  per-row inline form on the Progress Valuations table, generating a
  certificate for a specific, already-approved valuation. Certifying one
  (the `CERTIFIED` step of `PmoStatusActions`'s own advance) is what
  creates that certificate's own **Retention** — a percentage held back
  as security, released later.
- **Retention release** (`ReleaseRetentionForm`) — a single, page-level
  form (not per-row — there's at most one Retention record per work
  package), shown only while there's still an unreleased balance
  (`totalHeld − totalReleased > 0`); requesting more than that remaining
  balance is rejected outright, not partially honored.

## What ties PMO together

A project is the common thread: Tasks, Risks, Issues, BOQ, and Work
Packages are all created against one, and the PMO Dashboard's own
SPI/CPI and risk/issue summary are both scoped to a single project at a
time, not an entity-wide rollup. Risks that materialize become Issues
via the Risk Register's own Convert action, rather than needing to be
re-entered from scratch.
