'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { releasePlot, cancelPlotRelease } from './actions';

/**
 * Frontend Completion, FE-4.5 — Plot → Project Release, the checkpoint
 * FE-4.4's own doc comment already named as the natural next step once
 * `SubdividePlotsForm` existed. Mirrors `SurveyPlanActions.tsx`'s own
 * shape: one component handling both sides of a single plot's release
 * lifecycle, hidden entirely for statuses this checkpoint doesn't
 * cover.
 *
 * `releasePlotToProject` (`LandBankService`, confirmed directly) only
 * accepts a plot currently `AVAILABLE` — throws `BadRequestException`
 * otherwise — so the release form only renders for that status. It
 * also throws `ConflictException` if an uncancelled release already
 * exists for the plot; that's a genuine race this component can't
 * fully prevent client-side (two people releasing the same plot at
 * once), so its error is surfaced the same generic way every other
 * action's server-side error already is here, not specially guarded
 * against.
 *
 * `RESERVED`/`PLANNED`/`SOLD` plots get no action at all — same "don't
 * invent a workflow structure the backend doesn't enforce" reasoning
 * `page.tsx`'s own FE-4.4 doc comment already gave for leaving
 * `updatePlotStatus` unsurfaced; those three statuses have no
 * documented path into or out of them via any endpoint this checkpoint
 * touches.
 *
 * `ALLOCATED` plots show the release's own `projectId` raw (no
 * project-name join in `getParcel`'s response — same "id from a
 * registry with nothing joined into this particular response" shape
 * this app already uses elsewhere, e.g. Project Risks' own `projectId`
 * column) plus a Cancel form requiring `reason` (`CancelPlotReleaseDto`,
 * `@IsString()` required) — cancelling sets the plot back to
 * `AVAILABLE` server-side (confirmed directly), so no separate
 * `revalidatePath` bookkeeping is needed beyond what `actions.ts`
 * already does for every other mutation on this page.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Land Bank batch) — both `Button` usages in this file (Release,
 * Cancel release) had their own pre-FE-10.14 compact
 * `padding: space(1) space(2)`/`fontSize: '12px'` override removed,
 * now rendering at `Button`'s own properly-sized default touch target.
 * See `CloseBudgetButton.tsx`'s own ADDENDUM for the fuller reasoning
 * (removal, not resizing, and why).
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` override
 * population) — both this file's own field overrides (Cancellation
 * reason `TextField`, Project `Select`) are now ALSO removed
 * (`minWidth` preserved on each) — the sibling population the
 * `Button`-only fix above left out of scope at the time. Both fields
 * already had their own row-unique `id`s (`cancel-release-reason-${plotId}`,
 * `release-project-${plotId}`), so no missing-`id` gap to close
 * alongside this one, unlike `RequisitionStatusActions.tsx`/
 * `BudgetDecisionActions.tsx`.
 */
export function PlotReleaseActions({
  plotId,
  status,
  parcelId,
  projectOptions,
  release,
}: {
  plotId: string;
  status: string;
  parcelId: string;
  projectOptions: SelectOption[];
  release: { projectId: string; releaseDate: string; notes: string | null } | null;
}) {
  const [projectId, setProjectId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [releasePending, setReleasePending] = React.useState(false);
  const [releaseError, setReleaseError] = React.useState<string | null>(null);

  const [reason, setReason] = React.useState('');
  const [cancelPending, setCancelPending] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  async function handleRelease(e: React.FormEvent) {
    e.preventDefault();
    setReleasePending(true);
    setReleaseError(null);
    const result = await releasePlot(plotId, { projectId, notes: notes || undefined }, parcelId);
    setReleasePending(false);
    if (result.ok) {
      setProjectId('');
      setNotes('');
    } else {
      setReleaseError(result.error ?? 'Failed to release plot.');
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    setCancelPending(true);
    setCancelError(null);
    const result = await cancelPlotRelease(plotId, reason, parcelId);
    setCancelPending(false);
    if (result.ok) {
      setReason('');
    } else {
      setCancelError(result.error ?? 'Failed to cancel plot release.');
    }
  }

  if (status === 'ALLOCATED' && release) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.textMuted }}>
          Released to project {release.projectId}
        </span>
        <form onSubmit={handleCancel} style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end' }}>
          <TextField
            label="Cancellation reason"
            id={`cancel-release-reason-${plotId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            style={{ minWidth: '160px' }}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={cancelPending}
          >
            {cancelPending ? 'Cancelling…' : 'Cancel release'}
          </Button>
        </form>
        {cancelError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{cancelError}</span>}
      </div>
    );
  }

  if (status !== 'AVAILABLE') {
    return null;
  }

  return (
    <form onSubmit={handleRelease} style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <Select
          label="Project"
          id={`release-project-${plotId}`}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={projectOptions}
          placeholder="Select a project…"
          required
          style={{ minWidth: '180px' }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={releasePending}
        >
          {releasePending ? 'Releasing…' : 'Release'}
        </Button>
      </div>
      {releaseError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{releaseError}</span>}
    </form>
  );
}
