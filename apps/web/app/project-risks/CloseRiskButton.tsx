'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { closeRisk } from './actions';

/**
 * Frontend Completion — the one row action this checkpoint surfaces,
 * same "single action, no pending discriminant needed" shape
 * `RevokeLinkedAccountButton` already established. `assess`/`owner`/
 * `mitigation-plan`/`monitor`/`convert-to-issue` (all on the same
 * `RiskController`) are deliberately not built here — see `page.tsx`'s
 * own doc comment on why this checkpoint scoped to one resource with
 * one terminal action rather than the whole risk lifecycle.
 *
 * Hidden once already `CLOSED` — `RiskService.assertRiskOpen` itself
 * throws `ConflictException('This risk is already CLOSED')` in that
 * case (read directly), so this isn't just a UI nicety, it avoids a
 * click that would always fail.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target first slice)
 * — same fix, same reasoning as `CloseBudgetButton.tsx`'s own addendum
 * (read that one in full): the `padding: space(1) space(2)`/
 * `fontSize: '12px'` override is removed, letting `Button`'s own
 * FE-10.14-sized default apply. One of two files in this checkpoint's
 * own first, representative sample of a ~26-file gap, not the full
 * rollout.
 */
export function CloseRiskButton({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClose() {
    setPending(true);
    setError(null);
    const result = await closeRisk(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to close risk.');
  }

  if (status === 'CLOSED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button type="button" variant="secondary" disabled={pending} onClick={handleClose}>
        {pending ? 'Closing…' : 'Close'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
