'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { rejectSnag, resolveSnag, startSnag, verifySnag } from '../actions';

/**
 * Frontend Completion, FE-4.1. `SnagStatus` (`OPEN` -> `IN_PROGRESS` ->
 * `RESOLVED` -> `VERIFIED`, with `REJECTED` reachable from any
 * non-terminal state — confirmed directly against `HandoverService`:
 * `startSnagWork`/`resolveSnag`/`rejectSnag` have no status guard of
 * their own at all, only `verifySnag` does, "Only a RESOLVED snag can
 * be verified") is its own small state machine per row, distinct from
 * `HandoverActions`'s own record-level one — not reused as a single
 * shared component, since the two have different status enums and
 * different available-action rules entirely.
 *
 * ADDENDUM (FE-10.28, Mobile Responsiveness rollout) — all 4 `Button`
 * usages' own compact `style` override removed (Start, Resolve,
 * Verify, Reject); each now renders at `Button`'s own properly-sized
 * default touch target. Scoped to `Button` only, the same restraint
 * this rollout has applied throughout: the file's own two `TextField`
 * usages ("Resolution notes", "Rejection reason") keep their own
 * separate compact `style` overrides untouched — out of this rollout's
 * scope — and neither has an explicit `id` prop, a THIRD confirmed
 * instance of the same gap `RequisitionStatusActions.tsx`/
 * `BudgetDecisionActions.tsx` already flagged (duplicate ids across
 * `DataTable` rows), named here rather than silently expanded into.
 * Also worth naming plainly: this component has no test file at all
 * (confirmed directly — no `__tests__/SnagActions.test.tsx` exists
 * anywhere under this directory), unlike every other file this rollout
 * has touched, each of which had its own existing suite to re-run.
 * Nothing to re-run here as a result; this checkpoint verifies this
 * file only via `tsc` and the full sharded suite's own unchanged total.
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` population,
 * this file's own batch) — both `TextField` usages named above
 * ("Resolution notes", "Rejection reason") had their own compact
 * `style` override removed (`minWidth` preserved on each) AND an
 * explicit, row-unique `id` added (`resolution-notes-${id}`,
 * `rejection-reason-${id}`) — the combined fix, not the pure
 * style-only one, since FE-10.28's own addendum above had already
 * flagged neither field as having an `id` at all (the same
 * duplicate-`id`-across-`DataTable`-rows gap
 * `RequisitionStatusActions.tsx`/`BudgetDecisionActions.tsx` needed the
 * same combined treatment for). This is now the fourth confirmed
 * instance of that gap, not a third — worth correcting the running
 * count plainly rather than leaving FE-10.28's own "THIRD" stale.
 * `SnagActions.tsx`'s own zero-test-coverage gap is UNCHANGED by this
 * checkpoint — deliberately not addressed in the same pass: writing a
 * net-new test file is a materially different-shaped task from this
 * rollout's own mechanical style/id fixes, not a natural extension of
 * it, so it's left as its own explicitly-recommended next checkpoint
 * rather than folded in here.
 *
 * ADDENDUM (Stage FC-1 return, following FC-1.6's own recommendation
 * chain back to FE-10.41's "verify toolchain, then this file's own
 * test-coverage gap") — that gap is now closed:
 * `__tests__/SnagActions.test.tsx` added, 18 cases covering all four
 * status-gated branches (Start/Resolve/Verify/Reject) across every
 * status this component actually branches on (`OPEN`/`IN_PROGRESS`/
 * `RESOLVED`/terminal), the required-rejection-reason validation this
 * component enforces client-side, and the two explicit row-unique
 * `id`s the `TextField`/`Select` population pass already added
 * (asserted directly against their real values, not just presence).
 */
export function SnagActions({ id, status, handoverRecordId }: { id: string; status: string; handoverRecordId: string }) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [resolvedNotes, setResolvedNotes] = React.useState('');
  const [rejectReason, setRejectReason] = React.useState('');

  if (status === 'VERIFIED' || status === 'REJECTED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  async function run(kind: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(kind);
    setError(null);
    const result = await fn();
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to update snag.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end', minWidth: '220px' }}>
      <div style={{ display: 'flex', gap: tokens.space(1), flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {status === 'OPEN' && (
          <Button
            type="button"
            variant="primary"
            disabled={pending !== null}
            onClick={() => run('start', () => startSnag(id, handoverRecordId))}
          >
            {pending === 'start' ? 'Starting…' : 'Start'}
          </Button>
        )}
        {(status === 'OPEN' || status === 'IN_PROGRESS') && (
          <>
            <TextField
              label="Resolution notes (optional)"
              id={`resolution-notes-${id}`}
              value={resolvedNotes}
              onChange={(e) => setResolvedNotes(e.target.value)}
              disabled={pending !== null}
              style={{ minWidth: '160px' }}
            />
            <Button
              type="button"
              variant="primary"
              disabled={pending !== null}
              onClick={() => run('resolve', () => resolveSnag(id, handoverRecordId, resolvedNotes.trim() || undefined))}
            >
              {pending === 'resolve' ? 'Resolving…' : 'Resolve'}
            </Button>
          </>
        )}
        {status === 'RESOLVED' && (
          <Button
            type="button"
            variant="primary"
            disabled={pending !== null}
            onClick={() => run('verify', () => verifySnag(id, handoverRecordId))}
          >
            {pending === 'verify' ? 'Verifying…' : 'Verify'}
          </Button>
        )}
        <TextField
          label="Rejection reason"
          id={`rejection-reason-${id}`}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          disabled={pending !== null}
          style={{ minWidth: '160px' }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={() => {
            if (!rejectReason.trim()) {
              setError('A rejection reason is required.');
              return;
            }
            run('reject', () => rejectSnag(id, handoverRecordId, rejectReason.trim()));
          }}
        >
          {pending === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
