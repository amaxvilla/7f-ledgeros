'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { autoMatchSession, approveSession } from './actions';

/**
 * Frontend Completion, FE-3.6 — `ReconciliationSessionStatus` is a
 * two-value enum (`DRAFT`/`APPROVED`, confirmed directly), the simplest
 * status shape of any workflow resource in this codebase so far —
 * simpler than `JournalEntryStatusActions`'s five states or
 * `RequisitionStatusActions`'s three. Both actions require `DRAFT`
 * (`assertDraft`, confirmed directly against `autoMatch`/`approveSession`'s
 * own guards), so this component renders both buttons together for
 * `DRAFT` and nothing but the standard dash for `APPROVED` — no
 * intermediate branch needed.
 */
export function SessionActions({ sessionId, status }: { sessionId: string; status: string }) {
  const [pending, setPending] = React.useState<'auto-match' | 'approve' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAutoMatch() {
    setPending('auto-match');
    setError(null);
    const result = await autoMatchSession(sessionId);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to auto-match session.');
  }

  async function handleApprove() {
    setPending('approve');
    setError(null);
    const result = await approveSession(sessionId);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to approve session.');
  }

  if (status !== 'DRAFT') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Session is approved — no further changes.</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2) }}>
      <div style={{ display: 'flex', gap: tokens.space(3) }}>
        <Button type="button" variant="secondary" disabled={pending !== null} onClick={handleAutoMatch}>
          {pending === 'auto-match' ? 'Auto-matching…' : 'Auto-match'}
        </Button>
        <Button type="button" variant="primary" disabled={pending !== null} onClick={handleApprove}>
          {pending === 'approve' ? 'Approving…' : 'Approve session'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
