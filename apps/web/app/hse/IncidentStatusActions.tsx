'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { advanceIncidentStatus } from './actions';

/**
 * Frontend Completion — see `actions.ts`'s own doc comment for the
 * full before-coding analysis. `HseCaseStatus` (`OPEN`/`INVESTIGATING`/
 * `CLOSED`) is a different, shorter enum from PMO's own
 * `WORKFLOW_ORDER` (`DRAFT`/`REVIEWED`/`APPROVED`/`CERTIFIED`) — NOT
 * built on `@7f/ui`'s shared `PmoStatusActions`, whose `WORKFLOW_ORDER`
 * is hardcoded to that specific four-value PMO sequence (confirmed
 * directly reading that component — not a generic status-stepper
 * despite the "shared" framing, so genuinely not a fit here) rather
 * than assumed reusable from its name alone.
 *
 * One button at a time, no "reject" concept (`HseCaseStatus` has no
 * rejected-style terminal value the way PMO's `WORKFLOW_ORDER` pairs
 * with `REJECTED`) — `OPEN` shows "Start investigating"
 * (`-> INVESTIGATING`), `INVESTIGATING` shows "Close" (`-> CLOSED`),
 * `CLOSED` renders a dash. A `CLOSED` attempt blocked by open
 * corrective actions surfaces via the button's own inline error (the
 * backend's `ConflictException` message, unmodified) rather than a
 * client-side pre-check — see `actions.ts`'s own doc comment for why.
 *
 * ADDENDUM (FE-10.29, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. Part of the same
 * 4-file `hse/` batch as `NearMissStatusActions.tsx` — see that file's
 * own ADDENDUM for the batch's full context.
 */
const NEXT_STATUS: Record<string, { target: string; label: string; pendingLabel: string } | undefined> = {
  OPEN: { target: 'INVESTIGATING', label: 'Start investigating', pendingLabel: 'Starting…' },
  INVESTIGATING: { target: 'CLOSED', label: 'Close', pendingLabel: 'Closing…' },
};

export function IncidentStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const next = NEXT_STATUS[status];

  async function handleAdvance(target: string) {
    setPending(true);
    setError(null);
    const result = await advanceIncidentStatus(id, target);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to update incident status.');
  }

  if (!next) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => handleAdvance(next.target)}
      >
        {pending ? next.pendingLabel : next.label}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
