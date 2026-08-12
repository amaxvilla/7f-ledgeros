'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { endAssignment } from './actions';

/**
 * `end` (`POST /agent-assignments/:id/end`) requires `reason`
 * (`EndAgentAssignmentDto`, `@IsString()` required) — mirrors
 * `PlotReleaseActions.tsx`'s own Cancel-with-reason shape: an inline
 * `TextField` + `Button` pair, no modal (this app has none anywhere,
 * confirmed against that component's own doc comment). Hidden once
 * `isActive` is already `false` — same "don't render a pointless
 * control" convention `DeactivateEntityButton` established, rather than
 * a disabled button with no explanation.
 */
export function EndAssignmentButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const reasonId = React.useId();

  if (!isActive) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>Ended</span>;
  }

  async function handleEnd() {
    if (!reason.trim()) {
      setError('Enter a reason.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await endAssignment(id, reason.trim());
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to end assignment.');
      return;
    }
    setReason('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end' }}>
        <TextField
          label="Reason"
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ minWidth: '160px' }}
        />
        <Button type="button" variant="secondary" disabled={pending} onClick={handleEnd}>
          {pending ? 'Ending…' : 'End'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
