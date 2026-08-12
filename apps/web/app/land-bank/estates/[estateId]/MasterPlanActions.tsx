'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { approveMasterPlan } from './actions';

/**
 * Frontend Completion, FE-4.7 — Approve-only, deliberately: no
 * `rejectMasterPlan` route exists anywhere on `LandBankController`
 * (confirmed directly), unlike `SurveyPlanActions`/`TitleDeedActions`,
 * which both pair Approve with a real Reject. This isn't a trimmed copy
 * of either — there's nothing to reject.
 *
 * Hidden (renders `null`) for `APPROVED` and `SUPERSEDED` — both
 * confirmed terminal: `approveMasterPlan` throws `ConflictException` on
 * an already-`APPROVED` plan and `BadRequestException` on a
 * `SUPERSEDED` one (`LandBankService.approveMasterPlan`, confirmed
 * directly), so offering the button for either would only ever produce
 * a guaranteed-failing submit — same "don't offer what would always
 * fail" posture `SubdividePlotsForm`'s own survey-plan filter already
 * uses elsewhere in this module.
 *
 * ADDENDUM (FE-10.25, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. 20 of 25
 * originally-flagged files fixed now, 6 remaining.
 */
export function MasterPlanActions({ id, status, estateId }: { id: string; status: string; estateId: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status === 'APPROVED' || status === 'SUPERSEDED') {
    return null;
  }

  async function handleApprove() {
    setPending(true);
    setError(null);
    const result = await approveMasterPlan(id, estateId);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to approve master plan.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleApprove}
      >
        {pending ? 'Approving…' : 'Approve'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
