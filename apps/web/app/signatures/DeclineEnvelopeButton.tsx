'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { declineEnvelope } from './actions';

/**
 * Frontend Completion, SIG.1 — the one row action this checkpoint
 * surfaces, same "single action, no pending discriminant needed" shape
 * `CloseRiskButton` already established. `complete` (Checkpoint I) is
 * deliberately not built here — see `actions.ts`'s own doc comment.
 *
 * Hidden for an envelope already in a terminal state — `ManualSignatureService.recordDecline`
 * itself throws a `ConflictException` for COMPLETED/DECLINED/VOIDED (read
 * directly), the same "avoid a click that would always fail" reasoning
 * `CloseRiskButton`'s own doc comment gives.
 *
 * No reason input — `SignaturesController.decline`'s `reason` param is
 * optional, and this checkpoint doesn't add a text field for it; a
 * future checkpoint can add one to this same component if a real need
 * for it shows up, rather than guessing at a UI for it now.
 *
 * ADDENDUM (FE-10.24, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. This is the
 * direct fix for the transcription error FE-10.23's own report caught
 * and corrected in its own "Remaining Work" section (this file had been
 * silently dropped from that list without any real finding behind it);
 * confirmed directly here, before editing, that it still had its own
 * unfixed override — it did, exactly as that correction said. 19 of 25
 * originally-flagged files fixed now.
 */
const TERMINAL_STATUSES = new Set(['COMPLETED', 'DECLINED', 'VOIDED']);

export function DeclineEnvelopeButton({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDecline() {
    setPending(true);
    setError(null);
    const result = await declineEnvelope(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to decline envelope.');
  }

  if (TERMINAL_STATUSES.has(status)) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleDecline}
      >
        {pending ? 'Declining…' : 'Decline'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
