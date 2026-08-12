'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { approveBudget, rejectBudget } from './actions';

/**
 * Frontend Completion — Budgeting `approve`/`reject` (FIX.2's own
 * recommended next checkpoint). Read `BudgetingService.approve`/
 * `.reject` directly first, per that report's own instruction, rather
 * than assuming symmetry with `submit`: both are gated on `SUBMITTED`
 * only (`assertStatus`, confirmed directly) — one status earlier than
 * `close` (`APPROVED`) — and both accept the same optional
 * `BudgetDecisionDto.comments` string, unlike `submit`, which takes no
 * body at all.
 *
 * ONE SHARED COMMENTS FIELD, TWO BUTTONS: rather than two independent
 * inline forms each with their own comments box (redundant — a reviewer
 * writes one note, then picks a verdict, not two separate notes), this
 * component owns a single `comments` string in local state and both
 * `handleApprove`/`handleReject` read from it when calling their own
 * action. Plain `useState`, not `ActionForm`'s `FormData` contract —
 * `ActionForm` was built for exactly-one-action-per-form call sites
 * (`api-gateway`/`my-security`'s revoke/rename actions); a single field
 * feeding either of two different actions depending on which button was
 * clicked doesn't fit that shape, and `SubmitBudgetButton`'s own plain
 * `useState` pattern already covers it directly.
 *
 * Only ever rendered by `page.tsx` for `SUBMITTED` rows (see that file's
 * own Actions-column logic) — but still defensively returns the same
 * dash `SubmitBudgetButton`/`RequisitionActions` fall back to for any
 * other status, rather than assuming the caller never passes one, in
 * case a future checkpoint reuses this component from a second call
 * site with looser gating.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Budgeting batch) — both `Button` usages in this file (Approve,
 * Reject) had their own pre-FE-10.14 compact override removed, same
 * reasoning as `SubmitBudgetButton.tsx`'s own ADDENDUM in this same
 * directory.
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` override
 * population + missing-`id` gap, fixed together) — the Comments
 * `TextField`'s own identical `fontSize`/`padding` override is now
 * removed (no `minWidth` to preserve). Fixed in the SAME edit: the
 * missing-`id` gap the checkpoint above named but left open, since
 * both touched the same lines. Now `id={`budget-decision-comments-${id}`}`,
 * the same row-unique pattern `IssueRowActions.tsx`/`RiskRowActions.tsx`
 * already established.
 */
export function BudgetDecisionActions({ id, status }: { id: string; status: string }) {
  const [comments, setComments] = React.useState('');
  const [pending, setPending] = React.useState<'approve' | 'reject' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleApprove() {
    setPending('approve');
    setError(null);
    const result = await approveBudget(id, comments.trim() || undefined);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to approve budget.');
  }

  async function handleReject() {
    setPending('reject');
    setError(null);
    const result = await rejectBudget(id, comments.trim() || undefined);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to reject budget.');
  }

  if (status !== 'SUBMITTED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end', minWidth: '200px' }}>
      <TextField
        label="Comments (optional)"
        id={`budget-decision-comments-${id}`}
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        disabled={pending !== null}
      />
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        <Button
          type="button"
          variant="primary"
          disabled={pending !== null}
          onClick={handleApprove}
        >
          {pending === 'approve' ? 'Approving…' : 'Approve'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={handleReject}
        >
          {pending === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
