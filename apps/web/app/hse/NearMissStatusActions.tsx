'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { advanceNearMissStatus } from './actions';

/**
 * Frontend Completion, HSE.7 — see `actions.ts`'s own doc comment for
 * the full before-coding analysis. Mirrors `IncidentStatusActions`
 * directly — same `HseCaseStatus` enum (`OPEN`/`INVESTIGATING`/
 * `CLOSED`), same one-button-at-a-time shape, same reason it isn't
 * built on `@7f/ui`'s `PmoStatusActions` (that component's
 * `WORKFLOW_ORDER` is hardcoded to PMO's own four-value sequence, not
 * a generic status stepper).
 *
 * ONE REAL DIFFERENCE FROM `IncidentStatusActions`, CONFIRMED DIRECTLY
 * rather than assumed symmetric: `advanceNearMissStatus` has NO
 * corrective-action-closed guard — `advanceIncidentStatus`'s own
 * `ConflictException` (blocking `CLOSED` while open corrective actions
 * remain) is unique to incidents; `advanceNearMissStatus` just updates
 * the status unconditionally once the near miss itself is found. This
 * component's own "Close" button therefore has no inline-error case to
 * preserve beyond the generic failure path (still handled, in case of
 * a `NotFoundException` on a stale id, but no `ConflictException`
 * message is expected here in practice).
 *
 * ADDENDUM (FE-10.29, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. Part of the
 * 4-file `hse/` batch this checkpoint fixes (with `IncidentStatusActions.tsx`,
 * `CorrectiveActionActions.tsx`, `FinalizeChecklistButton.tsx`) — the
 * first genuinely directory-adjacent batch confirmed since FE-10.22's
 * own Procurement pair; these 4 files were found by FE-10.28's own
 * whole-app sweep, never part of the originally-tracked 25-file list.
 */
const NEXT_STATUS: Record<string, { target: string; label: string; pendingLabel: string } | undefined> = {
  OPEN: { target: 'INVESTIGATING', label: 'Start investigating', pendingLabel: 'Starting…' },
  INVESTIGATING: { target: 'CLOSED', label: 'Close', pendingLabel: 'Closing…' },
};

export function NearMissStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const next = NEXT_STATUS[status];

  async function handleAdvance(target: string) {
    setPending(true);
    setError(null);
    const result = await advanceNearMissStatus(id, target);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to update near miss status.');
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
