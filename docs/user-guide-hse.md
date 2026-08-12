# User Guide — HSE

Stage FC-5 (Documentation). Second module-family slice of the User
Guide, per FC-5.5's own recommendation. Confirmed directly against the
current repository (`apps/web/app/hse/`) that every component named
below still exists exactly as built, rather than assumed unchanged from
memory of building it.

`/hse` — enter an entity ID to view that entity's HSE dashboard: open
incidents, near misses, PPE expiring within 30 days, toolbox talks,
corrective actions, and inspection checklists, all in one place.

## Incidents

Log a new incident (`CreateIncidentReportForm`) against a project
(optional), with a description and severity. Each incident has its own
status lifecycle (**Actions** column, `IncidentStatusActions`) — advance
it through investigation to closure. **Closing an incident is blocked
while it still has open corrective actions of its own** — resolve those
first (see Corrective Actions below) if a close attempt is rejected.

## Near Misses

Same status-advancement shape as Incidents (`NearMissStatusActions`) —
**one real difference**: closing a near miss has no corrective-action
guard the way an incident does. A near miss can be closed even with
related corrective actions still open.

## PPE Issuances

Issue PPE to an employee (`CreatePpeIssuanceForm`): employee, item,
quantity, issued date, and an optional expiry date. The dashboard's own
PPE section shows what's expiring within 30 days — a proactive list, not
something you look up per employee.

## Toolbox Talks

Log a toolbox talk (`CreateToolboxTalkForm`): topic, date, who conducted
it, attendee count, optional notes. Record-only — a toolbox talk has no
status lifecycle or follow-up action of its own once logged.

## Corrective Actions

Raise a corrective action (`CreateCorrectiveActionForm`) against an
incident, a near miss, or a failed inspection-checklist item — assign it
to someone with a due date. **Complete** it (`CorrectiveActionActions`)
once the work is done; this is what unblocks a related incident's own
closure if it was waiting on this.

## Inspection Checklists

The most involved HSE workflow, deliberately built across three separate
checkpoints (create, then per-item results, then finalize) because it's
genuinely three distinct steps:

1. **Create** (`CreateInspectionChecklistForm`) — checklist type,
   inspection date, inspector, and a repeatable list of item
   descriptions (what's being checked) — starts at one item, add as many
   as the inspection needs.
2. **Record each item's result** (`RecordItemResultForm`, inline per item
   in the checklist's own row) — Compliant or Non-compliant, plus an
   optional remark, one item at a time. An item's result can't be
   changed once recorded — get it right the first time, or raise a
   Corrective Action against it separately if something needs following
   up.
3. **Finalize** (`FinalizeChecklistButton`) — only available once every
   item has a recorded result; the checklist's own overall PASS / FAIL /
   PASS WITH OBSERVATIONS outcome is derived automatically from the
   individual item results, not something you set yourself. If Finalize
   is rejected, it's almost always because at least one item still has
   no recorded result — check the item list above it.

## What this guide does not cover

Every other module family (Finance is covered separately — see
[`user-guide-finance.md`](./user-guide-finance.md) — plus Real Estate,
PMO, HR, Security, Enterprise Integrations, Administration) — each its
own real, separate slice, not attempted in this checkpoint.
