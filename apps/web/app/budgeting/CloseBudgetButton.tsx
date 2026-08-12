'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { closeBudget } from './actions';

/**
 * Frontend Completion — Budgeting `close` (BUD.3's own recommended next
 * checkpoint). Read `BudgetingService.close` directly first, per that
 * report's own instruction: gated on `APPROVED` only (`assertStatus`,
 * confirmed directly) — one status later than `approve`/`reject`'s own
 * `SUBMITTED` gate — and takes no request body at all (the service
 * writes its own fixed `'Budget closed at year end'` comment
 * server-side), unlike `approve`/`reject`'s optional `comments`. Same
 * shape as `SubmitBudgetButton` for that reason: one button, no input
 * field, plain `useState` pending/error tracking.
 *
 * A SEPARATE COMPONENT, NOT A THIRD BRANCH BUILT INTO
 * `BudgetDecisionActions`: `close` is a genuinely different action on a
 * different status (`APPROVED`, not `SUBMITTED`) with a different
 * permission gate in the backend (`BudgetingController.close` requires
 * `budget.approve`, same as `approve`/`reject` — but conceptually a
 * distinct lifecycle step, "this budget's spend authority is now
 * final," not a decision on a pending submission) — `page.tsx`'s own
 * Actions column already picks between components by status rather
 * than branching inside one, and this follows that same pattern rather
 * than growing `BudgetDecisionActions` to also handle `APPROVED`.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target first slice)
 * — the `padding: space(1) space(2)`/`fontSize: '12px'` override on
 * this button's own `Button` usage is REMOVED, not resized: `Button`'s
 * own default (`space(3) space(4)` padding, since FE-10.14) is now a
 * properly-sized touch target on its own, so overriding it smaller
 * here was actively working against the shared-primitive fix rather
 * than a merely redundant style. This is a real, visible sizing change
 * for this one button — deliberately not extended to the ~26 other
 * row-action components across this codebase sampled to have the
 * identical override (confirmed by a direct grep sweep, not assumed)
 * — that's a large, multi-checkpoint rollout of its own, this
 * checkpoint's own two-file slice is a first, representative sample,
 * not the full fix.
 */
export function CloseBudgetButton({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClose() {
    setPending(true);
    setError(null);
    const result = await closeBudget(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to close budget.');
  }

  if (status !== 'APPROVED') {
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
