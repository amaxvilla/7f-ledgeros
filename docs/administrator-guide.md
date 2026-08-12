# Administrator Guide

Stage FC-5 (Documentation). Covers the five system-wide administration
surfaces, each read directly (frontend page + backing controller) before
being described here, not assumed from module names.

## Entities

`/entities` — system-wide, not scoped to a single entity (an entity
administrator manages the entity list itself). Confirmed directly:
entities form a real hierarchy — `CreateEntityForm` takes an optional
**parent entity** (organizational reporting line) and a separate,
independently optional **consolidation parent** (which entity's
financial statements this one rolls up into) — these are two distinct
relationships, not one, and a given entity can have either, both, or
neither set.

Fields on create: code, name, legal name, tax ID (optional), registration
number (optional), base currency (optional), fiscal year start month
(optional), parent entity (optional), consolidation parent (optional).

Permission: `entity.manage` to create/deactivate, `entity.view` to read
— confirmed directly against `EntitiesController`.

Entities can be deactivated individually or in bulk (`DeactivateEntityButton`,
`BulkDeactivateEntitiesButton`) — deactivation, not deletion; a
deactivated entity's own historical data and postings are not removed.

## Users

`/users` — system-wide. Lists every user together with their current
role assignments (`UserRoleSummary[]` per user, confirmed directly in
the page's own data shape). Permission: `security.access.view` to read.

**CORRECTED — this section previously described role assignment as
read-only. Re-verified directly against the current `UsersController`
and this is no longer accurate.** `PUT /users/:id/roles`
(`SetUserRolesDto`, `rbac.manage`) is a real, working route — the
`/users/[id]` detail page's own `UserRolesForm` calls it. It is a
**full-replace**, not a diff: the request body is the complete set of
role ids the user should have going forward (unknown role ids are
rejected with a 404 before anything is written), and the endpoint
deletes every existing assignment for that user before creating the new
set in the same transaction — there is no separate "add one role" or
"remove one role" action, only "set the whole list."

## Roles & Permissions

`/roles` — system-wide. Shows the full permission catalog size
(`GET /permissions`) alongside the role list, each role with its own
`permissionCount`. `CreateRoleForm` takes code, name, and an optional
description — confirmed directly this form has no permission-picker of
its own; permissions are assigned separately, after creation, from the
role's own detail page (below).

**CORRECTED — this section previously described permission assignment
as read-only. Re-verified directly against the current
`RolesController` and this is no longer accurate.** `PUT
/roles/:id/permissions` (`SetRolePermissionsDto`, `rbac.manage`) is a
real, working route — the `/roles/[id]` detail page's own
`RolePermissionsForm` calls it. Same full-replace shape as user↔role
assignment above: the request body is the complete set of permission
codes the role should have (unknown codes rejected with a 404 first),
existing assignments deleted and the new set created in one
transaction.

**Role-based access control now has a working, self-service admin
console for both directions of assignment** (which permissions a role
has, and which roles a user has) — this corrects the prior finding that
RBAC was provisioned entirely outside its own UI. What remains outside
the UI: creating the permission catalog itself (`Permission` rows) and
the very first role/user for a fresh install — both still seed-data/
direct-database concerns, not something an administrator using this
app day to day would need to do.

Permission codes follow a `module.action` shape (confirmed across every
controller this session has touched): most controllers reference a
shared `PERMISSIONS` constants object (`roles`/`feature-flags`/`users`
all do); `EntitiesController` is a confirmed exception, using raw string
literals (`'entity.manage'`, `'entity.view'`) instead of that same
object — a small, real inconsistency, not a functional problem, noted
here rather than silently normalized away.

## Feature Flags

`/feature-flags` — system-wide. Fields on create: key (e.g.
`billing.v2`), description (optional), enabled/disabled status, and an
optional rollout percentage — confirmed directly this exists as a
distinct field from the on/off status, so a flag can be "enabled" at a
partial rollout percentage rather than only ever being a hard on/off
switch. Permission: `admin.feature_flags.view` to read,
`admin.feature_flags.manage` to create/toggle.

## Workflow Administration

`/workflow` and `/workflow/instances` — already covered in depth by this
session's own AP/HSE-adjacent history (definitions are reusable,
no-code approval-chain templates shared across modules; instances are
that template's own per-record execution history, looked up by
entity type + entity id since no global instance list exists). Not
re-described here — see the Workflow section of `CHECKPOINT_REPORT.md`'s
own FE-8.6/FE-8.7 entries for the full detail, or the app itself at
those two routes.

## What this guide does not cover

Queue Monitoring, Job Monitoring, System Configuration, Environment
Settings, and Integration Management — all named under Stage FC-3
(Administration) in this session's own roadmap, not Stage FC-5's own
"Administrator Guide" deliverable specifically, and not investigated in
this checkpoint. Confirm FC-3's own current state directly (the same
discipline this checkpoint applied to FC-5's own five surfaces) before
assuming whether they're built, partially built, or still open.
