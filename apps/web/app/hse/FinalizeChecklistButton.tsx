'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { finalizeChecklist } from './actions';

/**
 * Frontend Completion, HSE.6 — see `actions.ts`'s own doc comment for
 * the full before-coding analysis. `finalizeChecklist` takes no body
 * (confirmed directly), the same no-fields-button shape
 * `CorrectiveActionActions`'s own `Complete` button already uses.
 *
 * Hidden once `result` is already set — confirmed directly that
 * `finalizeChecklist` has no re-finalize semantics of its own (it just
 * re-derives and overwrites `result` from the current items), and no
 * other write path in this app re-triggers an already-terminal action,
 * the same posture `CorrectiveActionActions` takes for `COMPLETED`.
 *
 * Does NOT re-derive or pre-check "are all items assessed" client-side
 * before rendering the button — `finalizeChecklist`'s own
 * `BadRequestException` ("N item(s) have not been assessed yet",
 * confirmed directly) is surfaced as-is on failure, the same
 * "let the backend validate, surface its error" posture every other
 * write path on this page already takes (`createToolboxTalk`'s
 * negative-attendee-count check, `issuePpe`'s quantity/employee
 * checks).
 *
 * ADDENDUM (FE-10.29, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. Part of the same
 * 4-file `hse/` batch as `NearMissStatusActions.tsx` — see that file's
 * own ADDENDUM for the batch's full context.
 */
export function FinalizeChecklistButton({ id, result }: { id: string; result: string | null }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFinalize() {
    setPending(true);
    setError(null);
    const outcome = await finalizeChecklist(id);
    setPending(false);
    if (!outcome.ok) setError(outcome.error ?? 'Failed to finalize checklist.');
  }

  if (result !== null) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleFinalize}
      >
        {pending ? 'Finalizing…' : 'Finalize'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
