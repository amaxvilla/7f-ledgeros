'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { deactivateIpRule } from './actions';

/**
 * Frontend Completion, Security.2 — the one row action on the new IP
 * rules register. Hidden once a rule is already inactive (renders a
 * dash instead) — the same "don't offer what accomplishes nothing"
 * posture `BoqStatusActions`/`CloseRiskButton` already established for
 * their own terminal states, applied here to a genuinely terminal
 * one-way transition (`deactivateRule` has no corresponding
 * "reactivate," confirmed directly — the row's `isActive: false` is
 * permanent).
 *
 * No confirm dialog — this app has no modal primitive anywhere, the
 * same constraint every other single-click destructive action in this
 * app has already accepted.
 *
 * ADDENDUM (FE-10.27, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. Batched with
 * `DeactivateEntityButton.tsx` (Entities) this checkpoint — confirmed
 * directly the two do NOT sit in the same directory before batching
 * them. 24 of 25 originally-flagged files fixed now, 2 remaining.
 */
export function DeactivateIpRuleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDeactivate() {
    setPending(true);
    setError(null);
    const result = await deactivateIpRule(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to deactivate IP restriction rule.');
  }

  if (!isActive) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleDeactivate}
      >
        {pending ? 'Deactivating…' : 'Deactivate'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
