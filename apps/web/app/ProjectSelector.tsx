'use client';

import * as React from 'react';
import { tokens } from '@7f/ui';

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

/**
 * Frontend Completion — this app's first project-selector, unblocking
 * PMO Dashboard (deferred three checkpoints running for the exact
 * reason this component now resolves).
 *
 * A REAL GAP CORRECTED BEFORE BUILDING: `project-risks/CreateRiskForm.tsx`'s
 * own doc comment claims "no Projects registry exists anywhere in this
 * backend to build one from" — checked directly rather than trusted,
 * and that claim is WRONG. `GET /dimensions/projects?entityId=X`
 * (`DimensionsController.findProjects`, `dimension.view`) has existed
 * this whole time — confirmed directly against `DimensionsService
 * .findProjects`, a plain `prisma.project.findMany({ where: entityId ?
 * { entityId } : undefined, ... })`. `project-risks`/`project-issues`'s
 * own `projectId` `TextField`s were built on a false premise; NOT
 * changed in this checkpoint (a `Select` migration for those two forms
 * is a separate, real follow-up worth its own small checkpoint, out of
 * scope for "the smallest thing that unblocks PMO Dashboard").
 *
 * SAME GET-FORM-NAVIGATES SHAPE `EntitySelector` ALREADY ESTABLISHED,
 * NOT A NEW PATTERN: a `<select name="projectId">` inside a `method="GET"`
 * form, styled identically to `EntitySelector`'s own `<input>`/button —
 * this app has no client-side-fetch filter pattern anywhere yet (every
 * scope change is a full navigation with new `searchParams`, confirmed
 * by re-checking every existing page), so this follows that, not an
 * `onChange`-driven auto-submit.
 *
 * A HIDDEN `entityId` INPUT CARRIES THE CURRENT ENTITY SCOPE FORWARD —
 * unlike `EntitySelector` itself (which IS the entity scope), this
 * selector is a SECOND filter layered on top of an already-selected
 * entity; submitting must not drop `?entityId=` from the URL, which a
 * bare second GET form on the same page would otherwise do (only the
 * fields present in whichever form was actually submitted survive
 * naturally with a browser's own GET-form navigation).
 *
 * `projectOptions` is fetched by the calling page's own Server
 * Component and passed down, the same `accountOptions` pattern
 * `CreateBudgetForm` already established for `Select`'s own documented
 * "a future checkpoint wiring a dynamic option set" case — this
 * component itself has no data-fetching concern of its own.
 *
 * Deliberately a plain `<select>`, not `@7f/ui`'s own `Select` — that
 * component is built for controlled form state feeding a Server Action
 * (`onChange` updates React state, no `name` attribute is even read on
 * submit), not a native GET-form navigation where the browser itself
 * needs to read the field's `name`/`value` at submit time the way it
 * already does for `EntitySelector`'s plain `<input>`.
 *
 * `htmlFor`/`id` (via `React.useId()`) added to associate the label
 * with its select — the same real accessibility defect, and the same
 * fix, applied to `EntitySelector.tsx`/`SessionSelector.tsx` (see
 * `EntitySelector`'s own doc comment).
 */
export function ProjectSelector({
  entityId,
  projectOptions,
  initialValue,
}: {
  entityId: string;
  projectOptions: ProjectOption[];
  initialValue?: string;
}) {
  const [value, setValue] = React.useState(initialValue ?? '');
  const selectId = React.useId();

  return (
    <form method="GET" style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', marginBottom: tokens.space(6) }}>
      <input type="hidden" name="entityId" value={entityId} />
      <label htmlFor={selectId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Project</label>
      <select
        id={selectId}
        name="projectId"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          background: tokens.color.surfaceRaised,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.sm,
          color: tokens.color.textPrimary,
          padding: `${tokens.space(2)} ${tokens.space(3)}`,
          fontFamily: tokens.font.body,
          fontSize: '13px',
          minWidth: '280px',
        }}
      >
        <option value="">Select a project…</option>
        {projectOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        style={{
          background: tokens.color.accent,
          color: tokens.color.bg,
          border: 'none',
          borderRadius: tokens.radius.sm,
          padding: `${tokens.space(2)} ${tokens.space(4)}`,
          fontFamily: tokens.font.body,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        View
      </button>
    </form>
  );
}
