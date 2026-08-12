'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { completeCorrectiveAction } from './actions';

/**
 * Frontend Completion, HSE.2 — `completeCorrectiveAction` takes no
 * body (see `actions.ts`'s own doc comment), so this is a single
 * no-fields button, not a form. Hidden once `COMPLETED` — `OVERDUE`
 * still shows the button, since `completeCorrectiveAction` has no
 * status guard of its own (confirmed directly) and completing an
 * overdue action is a legitimate, common case.
 *
 * ADDENDUM (FE-10.29, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. Part of the same
 * 4-file `hse/` batch as `NearMissStatusActions.tsx` — see that file's
 * own ADDENDUM for the batch's full context.
 */
export function CorrectiveActionActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleComplete() {
    setPending(true);
    setError(null);
    const result = await completeCorrectiveAction(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to complete corrective action.');
  }

  if (status === 'COMPLETED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleComplete}
      >
        {pending ? 'Completing…' : 'Complete'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
