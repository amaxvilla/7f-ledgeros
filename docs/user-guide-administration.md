# User Guide — Administration

Stage FC-5 (Documentation). Eighth module-family slice of the User
Guide, per FC-5.13's own recommendation.

**Read this first — this guide's own scope is narrower than "Administration"
sounds.** Before writing anything, `docs/administrator-guide.md` was read
in full: it already covers Entities, Users, Roles & Permissions, and
Feature Flags in real depth — including role↔permission and user↔role
assignment, both real, working full-replace forms (`RolePermissionsForm`,
`UserRolesForm`) as of that guide's own most recent correction.
Re-documenting any of that here would duplicate, not add. This guide
covers the three Administration-family pages that guide does **not**
cover: Workflow, Notifications, and Queue — Workflow in particular has no
real prose documentation anywhere yet (the Administrator Guide's own
"Workflow Administration" section is a one-paragraph pointer to
`CHECKPOINT_REPORT.md`, not a description a user could actually follow).
For Entities, Users, Roles & Permissions, or Feature Flags, see the
Administrator Guide instead.

*Addendum: a fourth page, Admin Tools (`/admin-tools`), was added to
this guide later — see that section below for why.*

One naming collision worth flagging before either section below: **the
Queue page in this app (`/queue`) is a different thing from the
`bull-board` dashboard at `/admin/queues`** described in
`docs/operational-runbooks.md`. The runbook's page is a worker-level
operational tool (mounted on the worker process's own HTTP server,
covering every BullMQ queue by name); `/queue` below is an
application-level register of job *run history* (`JobRunLog` rows) plus
three trigger forms, served by the main API. They show related
information from different angles — neither replaces the other.

## Workflow

Two concerns behind one module, confirmed directly against
`WorkflowController`'s own eight routes: **Definitions** (reusable,
no-code approval-chain templates — read-only in this app today, no
create-form UI yet) and **Instances** (a definition's own per-record
execution history and the actions taken against it).

### Definitions (`/workflow`)

A read-only register of every workflow definition — code, name, entity
type it applies to, active/inactive, and its own ordered list of stages.
`GET /workflow/definitions` is called unfiltered (no entity-type filter
UI yet, though the endpoint supports one). Creating a new definition
(`POST /workflow/definitions`) has no form here — its own DTO is a
doubly-nested dynamic structure (stages, each with its own approval
rules, plus separate workflow-level rules) genuinely larger than any
single-level dynamic-line form elsewhere in this app; defining a new
workflow today means going through the API directly.

### Definition detail (`/workflow/[code]`)

Click a definition's own code from the register to see its stages in
full, plus two separate rule sections: **stage-level rules** (attached
to one specific approval stage — "this specific approval needs field X
to be true") and **workflow-level rules** (attached to the whole
definition, keyed to a stage sequence number — "skip this whole stage
unless..."). These are two different things read from two different
places in the data, shown in two separate sections rather than merged
into one table, since collapsing them would misrepresent what each rule
actually controls. Rule values are shown exactly as stored (a raw
string — number, text, boolean, or JSON array depending on the field
being checked) rather than reformatted per field type; this is a
reference view, not a rule simulator.

If the definition is active, a **"Start an instance"** form appears —
the one write action on this page. Inactive definitions don't get the
form at all: starting an instance of an inactive workflow is guaranteed
to fail server-side, so the form isn't offered for one.

### Instances (`/workflow/instances`)

**This is a lookup page, not a register you can browse.** There is no
route anywhere in this backend that lists every instance, or every
instance pending your own action — an instance only exists in relation
to a record in some other module (a requisition, a budget, or whatever
else was configured to use this engine), and the only way to find its
instances is by supplying that record's own entity type and entity ID.
Reach this page via the "Look up instances →" link on the Definitions
page, or by typing the entity type/ID pair directly if you already know
them.

Each instance found shows its own status, start/completion time, and
its stages' own individual statuses. Selecting one open instance reveals:

- **Act on it** — one form covering all eight possible actions (Submit,
  Review, Approve, Reject, Return, Post, Archive, Comment only) with an
  optional comment field. Only shown while the instance is `IN_PROGRESS`
  — every other status is rejected server-side before the engine even
  looks at what action was requested, so the form only appears when an
  action could actually succeed.
- **Resubmit** — for an instance that was returned or rejected, sends it
  back into the approval chain from the start.

One more thing worth knowing: this app already has one real internal
user of this same engine — Recruitment's own requisition approval flow
(`/recruitment`, the requisition detail actions) — but it goes through
Recruitment's own endpoints, not this page. The two don't link to each
other. This page is the generic, module-agnostic way to inspect or act
on *any* instance across *any* module that uses the engine, by its own
entity reference; it isn't a replacement for a module's own
purpose-built approval screen where one already exists.

## Notifications

Two genuinely separate surfaces, easy to conflate since they show
overlapping data:

### The header bell (every page)

Backed by a small widget (`GET /dashboard/my-notifications`) — always
your 5 most recent **unread** notifications, plus a live unread count.
It never shows a read notification, and never shows more than 5. Mark
one read, or mark all read, from here.

### The full register (`/notifications`)

Everything the header bell can't show: every notification you've ever
received, read or unread, with filters by status, channel, and an
unread-only toggle. This uses the same two mark-as-read actions as the
header widget (same underlying endpoints, nothing new here) applied to
a genuinely complete, filterable list rather than a 5-row preview. The
unread count shown here isn't fetched separately — it's the exact same
number the header widget already computes live, so there's no risk of
the two disagreeing.

### Delivery stats (admin) (`/notifications/admin`)

A separate page, separate permission, separate audience: a system-wide
rollup of every notification ever sent, broken down by status and by
channel — with no per-user or per-entity scoping at all. This has
nothing to do with any individual's own notification history; it's an
operational view of whether the notification system as a whole is
delivering. Reached via a small link from the main Notifications page,
not its own nav entry — the same "linked from its parent page, no
separate nav link" pattern this app uses for a few other admin-adjacent
sub-pages.

## Queue (`/queue`)

A system-wide, un-scoped register (no entity selector — job runs aren't
tied to a single entity the way most other registers in this app are)
of background job execution history: which queue and job, its status
(queued, active, completed, failed), attempt count, timing, and — for
jobs that produce a downloadable result — a link to it. That link is
resolved against the API server's own address, not this web app's own
address, since a generated file is served by the API, not the frontend.

Three of the backend's four job-trigger endpoints have a form here:

- **Refresh a dashboard** — one optional field.
- **Recalculate a budget** — two optional fields.
- **Generate a report** — pick a report type (one of seven), an entity,
  optionally a fiscal year, and an output format (JSON or CSV).

The fourth, **importing a bank statement**, has no form: its own
required fields include a file URL, implying a prerequisite file-upload
step this app doesn't have a pattern for anywhere yet. Triggering that
import today means calling the API directly with an already-hosted
file's URL.

The register itself shows the 50 most recent job runs across every
queue (the backend's own default when no filter is supplied); there's
no filter-by-queue or filter-by-status control on this page yet, though
the underlying endpoint supports both.

## Admin Tools (`/admin-tools`)

*Added as part of the FC-5 Dashboards & Reports checkpoint, which found
this page had zero mentions anywhere in `docs/` while auditing every
route in the app for User Guide coverage.*

A small, standalone page for one-off bulk/maintenance actions that
don't belong to any single module's own page — today, that's exactly
one form: **Flag overdue corrective actions**. Pick an "as of" date and
run it to mark every HSE corrective action past its due date (and not
yet completed) as overdue; the page reports back how many it flagged.
There's no entity picker here — the underlying action isn't scoped to
one entity, it sweeps every corrective action system-wide.

This route exists on its own rather than living under `/hse` because
it doesn't fit any existing module page, and two other candidate
locations (`/queue`, and the roadmap's own "System Configuration" item)
were checked and found to have nothing backing either name. Expect more
actions to land here over time as similar bulk/maintenance needs come
up elsewhere in the app.
