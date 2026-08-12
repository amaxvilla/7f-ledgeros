'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { submitBudget } from './actions';

/**
 * Frontend Completion — see `page.tsx`'s own doc comment for why
 * `submit` is this checkpoint's one row action: confirmed directly
 * against `BudgetingService.submit`'s own `assertStatus` guard, callable
 * only from `DRAFT` or `REJECTED`. Hidden for every other status
 * (`SUBMITTED`, `APPROVED`, `FROZEN`, `CLOSED`) — offering it there
 * would just error, the same "don't offer what accomplishes nothing"
 * posture `ResolveIssueButton`/`VacancyActions` already take for their
 * own terminal/in-flight states.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Budgeting batch) — this file's own `Button` usage had its
 * pre-FE-10.14 compact override removed, same reasoning as
 * `RiskRowActions.tsx`'s own ADDENDUM (Project Risks batch), which
 * chains back to `PlotReleaseActions.tsx`/`CloseBudgetButton.tsx`.
 */
export function SubmitBudgetButton({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setPending(true);
    setError(null);
    const result = await submitBudget(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to submit budget.');
  }

  if (status !== 'DRAFT' && status !== 'REJECTED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleSubmit}
      >
        {pending ? 'Submitting…' : 'Submit'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
