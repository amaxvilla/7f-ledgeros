'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { approveSurveyPlan, rejectSurveyPlan } from './actions';

/**
 * Frontend Completion, FE-4.3 — mirrors `TitleDeedActions.tsx`'s own
 * shape: two independently-triggered actions in one cell, rather than
 * a single linear `WORKFLOW_ORDER` advance/reject pair.
 *
 * "Approve" has NO fields at all — `ApproveSurveyPlanDto.notes` exists
 * on the DTO but `LandBankController.approveSurveyPlan` receives it as
 * `@Body() _dto: ApproveSurveyPlanDto` (confirmed directly, the
 * underscore prefix is the controller's own signal) and never passes
 * it to `LandBankService.approveSurveyPlan`, which takes no `notes`
 * parameter at all. Collecting a field the backend silently discards
 * would be actively misleading, not just unused — so this form has no
 * field, not an optional one.
 *
 * "Reject" still requires `reason` (`RejectSurveyPlanDto`, `@IsString()`)
 * even though — confirmed directly, a genuine difference from
 * `rejectTitleDeed` — `LandBankService.rejectSurveyPlan` doesn't persist
 * it anywhere either (the service's own comment: captured only via the
 * automatic audit trail, "revisit if a queryable rejection reason is
 * needed"). Still required client-side because the DTO itself requires
 * it; this table's own Survey plans list has no "notes"-equivalent
 * column to render it back out of, unlike Titles.
 *
 * Hidden (renders `null`) once `APPROVED` or `REJECTED` — both
 * confirmed terminal (no endpoint transitions a survey plan out of
 * either). `DRAFT` is included in the actionable set alongside
 * `SUBMITTED` even though `createSurveyPlan` never produces one
 * (confirmed directly — same "unreachable via any current create path,
 * but not assumed impossible" posture `TitleDeedActions.tsx` already
 * took for `PENDING`).
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Land Bank batch) — both `Button` usages in this file (Approve,
 * Reject) had their own pre-FE-10.14 compact override removed, same
 * reasoning as `PlotReleaseActions.tsx`'s own ADDENDUM (which points to
 * `CloseBudgetButton.tsx`'s own fuller reasoning).
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` override
 * population) — the Rejection-reason `TextField`'s own identical
 * `fontSize: '12px'`/`padding` override is now ALSO removed
 * (`minWidth` preserved) — this file's own `Button`-only fix above
 * left this one field out of scope at the time; closed now that this
 * rollout's own sweep found the sibling `TextField`/`Select`
 * population this file was part of.
 */
export function SurveyPlanActions({ id, status, parcelId }: { id: string; status: string; parcelId: string }) {
  const [approvePending, setApprovePending] = React.useState(false);
  const [approveError, setApproveError] = React.useState<string | null>(null);

  const [reason, setReason] = React.useState('');
  const [rejectPending, setRejectPending] = React.useState(false);
  const [rejectError, setRejectError] = React.useState<string | null>(null);

  async function handleApprove() {
    setApprovePending(true);
    setApproveError(null);
    const result = await approveSurveyPlan(id, parcelId);
    setApprovePending(false);
    if (!result.ok) setApproveError(result.error ?? 'Failed to approve survey plan.');
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setRejectPending(true);
    setRejectError(null);
    const result = await rejectSurveyPlan(id, reason, parcelId);
    setRejectPending(false);
    if (result.ok) {
      setReason('');
    } else {
      setRejectError(result.error ?? 'Failed to reject survey plan.');
    }
  }

  if (status === 'APPROVED' || status === 'REJECTED') {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={approvePending}
        onClick={handleApprove}
      >
        {approvePending ? 'Approving…' : 'Approve'}
      </Button>
      {approveError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{approveError}</span>}

      <form onSubmit={handleReject} style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <TextField
          label="Rejection reason"
          id={`reject-reason-${id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={rejectPending}
        >
          {rejectPending ? 'Rejecting…' : 'Reject'}
        </Button>
      </form>
      {rejectError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{rejectError}</span>}
    </div>
  );
}
