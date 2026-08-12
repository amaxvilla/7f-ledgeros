'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { submitRequisition, approveRequisition, rejectRequisition } from './actions';

/**
 * Frontend Completion, FE-3.3 — combines `SubmitBudgetButton`'s simple
 * submit shape (for `DRAFT`/`REJECTED`) with `BudgetDecisionActions`'s
 * shared-comments-field shape (for `SUBMITTED`) into one component,
 * since a single Actions column cell can only show one of the two at a
 * time for any given row anyway — see `actions.ts`'s own doc comment
 * for the confirmed status guards this mirrors.
 *
 * ADDENDUM (FE-10.22, Mobile Responsiveness rollout) — all three
 * `Button` usages' own compact `style` override (`padding:
 * space(1)/space(2), fontSize: 12px`) removed; each now renders at
 * `Button`'s own properly-sized default touch target, same fix this
 * rollout has now applied across 15 of 25 originally-flagged files. A
 * 3+2 split with `PurchaseOrderStatusActions.tsx` (its own sibling
 * ADDENDUM) — yet another distinct shape from every prior batch's own
 * count, continuing to confirm this rollout's standing point that
 * per-file counts aren't uniform and are worth checking directly each
 * time rather than assumed from a neighboring file.
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` override
 * population + missing-`id` gap, fixed together) — the Comments
 * `TextField`'s own identical `fontSize`/`padding` override is now
 * removed (it had no `minWidth` to preserve, so the `style` prop is
 * gone entirely). Fixed in the SAME edit: the missing-`id` gap the
 * checkpoint above named but deliberately left open — since both
 * touched the same lines, doing them separately would have meant two
 * passes over identical code. Now `id={`requisition-comments-${id}`}`,
 * the same row-unique pattern `IssueRowActions.tsx`/`RiskRowActions.tsx`
 * already established, closing the duplicate-`id`-across-rows bug for
 * this file.
 */
export function RequisitionStatusActions({ id, status }: { id: string; status: string }) {
  const [comments, setComments] = React.useState('');
  const [pending, setPending] = React.useState<'submit' | 'approve' | 'reject' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setPending('submit');
    setError(null);
    const result = await submitRequisition(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to submit requisition.');
  }

  async function handleApprove() {
    setPending('approve');
    setError(null);
    const result = await approveRequisition(id, comments.trim() || undefined);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to approve requisition.');
  }

  async function handleReject() {
    setPending('reject');
    setError(null);
    const result = await rejectRequisition(id, comments.trim() || undefined);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to reject requisition.');
  }

  if (status === 'DRAFT' || status === 'REJECTED') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={handleSubmit}
        >
          {pending === 'submit' ? 'Submitting…' : 'Submit'}
        </Button>
        {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
      </div>
    );
  }

  if (status === 'SUBMITTED') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end', minWidth: '200px' }}>
        <TextField
          label="Comments (optional)"
          id={`requisition-comments-${id}`}
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

  return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
}
