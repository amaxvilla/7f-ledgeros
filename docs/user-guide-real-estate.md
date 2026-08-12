# User Guide — Real Estate

Stage FC-5 (Documentation). Third module-family slice of the User
Guide, per FC-5.9's own recommendation. Confirmed directly against the
current repository (`apps/web/app/land-bank/`, `real-estate/sales/`,
`crm/`, `mortgage/`, `handover/`, `lease-management/`,
`facility-management/`) that every component named below still exists
exactly as built, rather than assumed unchanged from any earlier
session's own build history for this module family.

Real Estate is the largest module family in this app — seven sub-areas,
several with their own multi-step, branching lifecycles rather than a
single linear status. Each is covered below in the rough order a
property moves through them: Land Bank → Sales → CRM → Mortgage →
Handover, with Lease Management and Facility Management as their own
independent, simpler areas.

## Land Bank

`/land-bank` — enter an entity ID to see every land parcel on record,
each row summarizing its own acquisitions, title deeds, survey plans,
and plots as counts. Create a new estate (`CreateEstateForm`) or parcel
(`CreateParcelForm`) from here; record an acquisition against an
existing parcel (`RecordAcquisitionForm`).

Open a parcel's own detail page (`/land-bank/[parcelId]`) for the real
work:

- **Title Deeds** (`AddTitleDeedForm`, then `TitleDeedActions`) — a
  deed starts `PENDING`/`IN_PROGRESS` and is either **Perfected**
  (a three-field form) or **Rejected** (one field, a reason).
  `PERFECTED`/`REJECTED`/`EXPIRED` are all terminal — no further action
  once a deed reaches any of them.
- **Survey Plans** (`CreateSurveyPlanForm`, then `SurveyPlanActions`) —
  **Approve** takes no fields at all (the backend accepts notes but
  never stores them, so this form doesn't ask for one); **Reject**
  requires a reason. Terminal at `APPROVED`/`REJECTED`.
- **Plots** (`SubdividePlotsForm` to create them from a parcel, then
  `PlotReleaseActions` on each) — only an `AVAILABLE` plot can be
  released to a project; `RESERVED`/`PLANNED`/`SOLD` plots have no
  action available here at all.

An estate's own detail page (`/land-bank/estates/[estateId]`) handles
its Master Plan separately: create one (`CreateMasterPlanForm`), then
**Approve** it (`MasterPlanActions`) — **there is no Reject for a
Master Plan**, only Approve. Terminal at `APPROVED`/`SUPERSEDED`.

## Property Sales

`/real-estate/sales` — pick an entity, then a project, to see that
project's own units and reservation pipeline. **Reserve a unit**
(`ReserveUnitForm`) for a customer to start the sales process for that
unit.

Open a unit's own detail page (`/real-estate/sales/[unitId]`) once it
has an active reservation or allocation for the rest of the workflow:

- **Cancel** the current reservation or allocation (`CancelCurrentForm`
  — one shared component, one `reason` field either way; which one it
  cancels depends on the unit's own current status).
- **Convert** an active reservation into a sale (`ConvertReservationForm`)
  — a bigger, five-field form: sale price, allocation date, invoice
  number, and the two GL account IDs the sale posts against. This is
  where a reservation becomes a real allocation.
- Once allocated, **Transfer** the allocation to a different customer
  (`TransferAllocationForm`) or **Swap** it onto a different unit
  (`SwapUnitForm`) — each its own reason-plus-one-field form.
- **Create an installment schedule** (`CreateInstallmentScheduleForm`)
  against an allocation — add as many due-date/amount rows as the
  payment plan needs; the total must match the sale price.

The unit detail page's own event history (below all of the above) is
the audit trail for everything that's happened to that unit — every
reservation, cancellation, conversion, transfer, and swap, in order.

## CRM

`/crm` — enter an entity ID for the CRM dashboard (lead pipeline by
stage) and lead register. Log a new lead (`CreateLeadForm`) with
contact details and source. Leads are record-and-track here; there's no
separate CRM lifecycle-action component beyond creation and the
dashboard's own stage breakdown.

## Mortgage

`/mortgage` — entity-scoped dashboard (exposure by lender/status) and
application register. Submit a mortgage application
(`CreateMortgageApplicationForm`) linking a customer, a unit sale
allocation, a lender, and the applied amount. Like CRM, this is a
record-and-track area — no separate approval/decline action exists in
this app yet.

## Handover

`/handover` — schedule a handover (`ScheduleHandoverForm`) for a
completed unit sale. Open a handover's own detail page
(`/handover/[id]`) for everything else:

- **Handover actions** (`HandoverActions`) — `Inspect` and `Cancel` are
  both available from any of `SCHEDULED`, `INSPECTION_DONE`, or
  `SNAGS_PENDING`; they're independent actions, not a single
  advance-one-step button. **Complete** additionally refuses while any
  snag on the handover is still `OPEN` or `IN_PROGRESS` — resolve those
  first if Complete is rejected. Completing a handover asks for seven
  GL identifiers, needed to post the revenue-recognition entry this
  action also triggers.
- **Snags** (`AddSnagForm`, then `SnagActions`, one row per snag) —
  `OPEN` → `IN_PROGRESS` → `RESOLVED` → `VERIFIED`, with **Reject**
  reachable from any non-terminal state at any point. Only a
  `RESOLVED` snag can be verified — trying to verify one still `OPEN`
  or `IN_PROGRESS` is rejected server-side.

## Lease Management

`/lease-management` — entity-scoped dashboard and lease register.
Create a lease (`CreateLeaseForm`) linking a tenant to a unit with its
own rent amount, deposit, and term dates. Tenants themselves
(`GET /tenants`, a sibling resource) are deliberately not surfaced on
this page — record-and-track only here, same as CRM and Mortgage.

## Facility Management

`/facility-management` — entity-scoped dashboard and maintenance
request register. Log a maintenance request
(`CreateMaintenanceRequestForm`) against a unit with a description and
priority. Record-and-track only — no status-advancement action exists
for a maintenance request in this app yet.

## What's genuinely record-and-track vs. a real workflow

Worth knowing going in: **Land Bank, Property Sales, and Handover** all
have real multi-step, branching status lifecycles with dedicated action
components per stage. **CRM, Mortgage, Lease Management, and Facility
Management** are simpler — create a record, see it on a dashboard and in
a register, with no further status-changing action available in this
app today. That's not an oversight this guide is glossing over; it's
the real, current shape of each area's own backend surface.
