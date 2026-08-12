'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { perfectTitleDeed, rejectTitleDeed } from './actions';

/**
 * Frontend Completion, FE-4.2 — mirrors `RiskWorkflowActions.tsx`'s own
 * shape directly: two independently-triggered actions with genuinely
 * different field requirements (a three-field "Perfect" form, a
 * one-field "Reject" form), not a single linear advance/reject pair
 * the shared `WORKFLOW_ORDER` component elsewhere in this app handles
 * — the same reasoning `RiskWorkflowActions.tsx`'s own doc comment
 * gives for why it's a new, standalone component rather than an
 * expansion of a shared status-actions primitive.
 *
 * Hidden (renders `null`, no dash — same convention `RiskWorkflowActions.tsx`
 * itself uses) once `PERFECTED`, `REJECTED`, or `EXPIRED` — all three
 * are terminal (confirmed directly: no endpoint anywhere in
 * `LandBankController` transitions a title deed out of any of them).
 * Both `PENDING` and `IN_PROGRESS` are treated as actionable — `PENDING`
 * itself appears unreachable through any current create path (see
 * `actions.ts`'s own doc comment) but is included in the actionable set
 * rather than assumed impossible, in case a future endpoint or seed
 * path produces one.
 *
 * Each `TextField`'s default `id` is label-derived, not row-unique —
 * the same duplicate-`id`-across-`DataTable`-rows bug
 * `RiskWorkflowActions.tsx`/`RiskRowActions.tsx`/`IssueRowActions.tsx`
 * have each already caught; fixed here the same way from the start.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Land Bank batch) — both `Button` usages in this file (Perfect,
 * Reject) had their own pre-FE-10.14 compact override removed, same
 * reasoning as `PlotReleaseActions.tsx`'s own ADDENDUM. At the time,
 * this file's own three `TextField` overrides were deliberately left
 * unchanged, `Button`-only scoping for that rollout.
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` population) —
 * those three deferred overrides (Issued date, Expiry, Title #) plus
 * the Rejection-reason `TextField` (four fields total) are removed now
 * (`minWidth` preserved on each). No missing-`id` fix needed alongside
 * any of the four — confirmed directly, all four already had their own
 * row-unique `id` from this file's very first version (see above), the
 * pure style-only shape. **This is the last file in the population** —
 * with this checkpoint, every `TextField`/`Select` flagged across this
 * rollout's own tracked set has now been fixed; a fresh whole-app sweep
 * for the override string (scoped to non-test `.tsx` files) confirms
 * zero remaining occurrences anywhere.
 */
export function TitleDeedActions({ id, status, parcelId }: { id: string; status: string; parcelId: string }) {
  const [issuedDate, setIssuedDate] = React.useState('');
  const [expiryDate, setExpiryDate] = React.useState('');
  const [titleNumber, setTitleNumber] = React.useState('');
  const [perfectPending, setPerfectPending] = React.useState(false);
  const [perfectError, setPerfectError] = React.useState<string | null>(null);

  const [reason, setReason] = React.useState('');
  const [rejectPending, setRejectPending] = React.useState(false);
  const [rejectError, setRejectError] = React.useState<string | null>(null);

  async function handlePerfect(e: React.FormEvent) {
    e.preventDefault();
    setPerfectPending(true);
    setPerfectError(null);
    const result = await perfectTitleDeed(id, { issuedDate, expiryDate: expiryDate || undefined, titleNumber: titleNumber || undefined }, parcelId);
    setPerfectPending(false);
    if (result.ok) {
      setIssuedDate('');
      setExpiryDate('');
      setTitleNumber('');
    } else {
      setPerfectError(result.error ?? 'Failed to perfect title deed.');
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setRejectPending(true);
    setRejectError(null);
    const result = await rejectTitleDeed(id, reason, parcelId);
    setRejectPending(false);
    if (result.ok) {
      setReason('');
    } else {
      setRejectError(result.error ?? 'Failed to reject title deed.');
    }
  }

  if (status === 'PERFECTED' || status === 'REJECTED' || status === 'EXPIRED') {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <form onSubmit={handlePerfect} style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <TextField
          label="Issued date"
          id={`perfect-issued-date-${id}`}
          type="date"
          value={issuedDate}
          onChange={(e) => setIssuedDate(e.target.value)}
          required
          style={{ minWidth: '130px' }}
        />
        <TextField
          label="Expiry (optional)"
          id={`perfect-expiry-date-${id}`}
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          style={{ minWidth: '130px' }}
        />
        <TextField
          label="Title # (optional)"
          id={`perfect-title-number-${id}`}
          value={titleNumber}
          onChange={(e) => setTitleNumber(e.target.value)}
          style={{ minWidth: '120px' }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={perfectPending}
        >
          {perfectPending ? 'Perfecting…' : 'Perfect'}
        </Button>
      </form>
      {perfectError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{perfectError}</span>}

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
