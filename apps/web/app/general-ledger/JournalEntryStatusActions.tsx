'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import {
  submitJournalEntry,
  approveJournalEntry,
  rejectJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
} from './actions';

type Action = 'submit' | 'approve' | 'reject' | 'post' | 'reverse';

/**
 * Frontend Completion, FE-3.1 — one action per status, unlike
 * `BoqStatusActions`'s own "advance to the next step, computed from a
 * shared WORKFLOW_ORDER array" shape. `JournalEntryStatus` isn't a
 * single linear sequence with one generic transition endpoint the way
 * `PmoService.advanceGeneric` is: `PENDING_APPROVAL` branches two ways
 * (`approve` OR `reject`, both `gl.journal.approve`), and each step is
 * its own dedicated backend route (confirmed directly against
 * `GeneralLedgerController` — see `actions.ts`'s own doc comment), so
 * this component switches on `status` explicitly rather than deriving
 * a "next" target from an ordered list.
 *
 * `REVERSED` and `REJECTED` are both terminal — same dash fallback
 * `BoqStatusActions`/`CloseRiskButton` already use for their own
 * terminal statuses. `POSTED` is NOT terminal (unlike BOQ's own
 * `CERTIFIED`): a posted entry can still be reversed
 * (`PostingEngineService.reverse`, `gl.journal.post`), which is why it
 * gets its own single-button branch instead of falling into the dash
 * case.
 *
 * ADDENDUM (FE-10.28, Mobile Responsiveness rollout) — all 5 `Button`
 * usages' own compact override removed; now render at `Button`'s own
 * properly-sized default touch target. A DIFFERENT SHAPE from every
 * prior file in this rollout: this file defined one shared
 * `buttonStyle` const reused via `style={buttonStyle}` across all 5
 * `Button`s, rather than 5 separate inline `style={{...}}` literals —
 * the const declaration itself is removed here too, not just its 5
 * references, since nothing else in the file used it. Confirmed
 * directly (not assumed) that removing it left no other reference
 * behind.
 */
export function JournalEntryStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState<Action | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(action: Action, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setPending(action);
    setError(null);
    const result = await fn(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to update journal entry.');
  }

  let buttons: React.ReactNode = null;

  if (status === 'DRAFT') {
    buttons = (
      <Button
        type="button"
        variant="primary"
        disabled={pending !== null}
        onClick={() => run('submit', submitJournalEntry)}
      >
        {pending === 'submit' ? 'Submitting…' : 'Submit for approval'}
      </Button>
    );
  } else if (status === 'PENDING_APPROVAL') {
    buttons = (
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        <Button
          type="button"
          variant="primary"
          disabled={pending !== null}
          onClick={() => run('approve', approveJournalEntry)}
        >
          {pending === 'approve' ? 'Approving…' : 'Approve'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={() => run('reject', rejectJournalEntry)}
        >
          {pending === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
    );
  } else if (status === 'APPROVED') {
    buttons = (
      <Button
        type="button"
        variant="primary"
        disabled={pending !== null}
        onClick={() => run('post', postJournalEntry)}
      >
        {pending === 'post' ? 'Posting…' : 'Post'}
      </Button>
    );
  } else if (status === 'POSTED') {
    buttons = (
      <Button
        type="button"
        variant="secondary"
        disabled={pending !== null}
        onClick={() => run('reverse', reverseJournalEntry)}
      >
        {pending === 'reverse' ? 'Reversing…' : 'Reverse'}
      </Button>
    );
  }

  if (!buttons) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      {buttons}
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
