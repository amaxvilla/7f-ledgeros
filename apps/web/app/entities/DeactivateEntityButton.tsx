'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { deactivateEntity } from './actions';

/**
 * Frontend Completion, FE-8.2 — mirrors `DeactivateIpRuleButton.tsx`
 * directly: a genuinely terminal, one-way transition (`deactivate` sets
 * `isActive: false`, no corresponding "reactivate" endpoint anywhere on
 * `EntitiesController`, confirmed directly), hidden once already
 * inactive rather than left clickable-but-pointless. No confirm dialog
 * — this app has no modal primitive anywhere (confirmed directly,
 * `DeactivateIpRuleButton.tsx`'s own doc comment re-checked as the
 * precedent), the same constraint every other single-click destructive
 * action in this app has already accepted.
 *
 * ADDENDUM (FE-10.27, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. Batched with
 * `DeactivateIpRuleButton.tsx` (Security) this checkpoint, the same
 * component this file's own doc comment already names as its direct
 * precedent — confirmed directly the two do NOT sit in the same
 * directory (`entities` vs. `security`) before batching them, the same
 * "confirm, don't assume from the name" check FE-10.26's own Revoke
 * pair already applied.
 */
export function DeactivateEntityButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDeactivate() {
    setPending(true);
    setError(null);
    const result = await deactivateEntity(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to deactivate entity.');
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
