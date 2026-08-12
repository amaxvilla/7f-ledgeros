'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { reviseBudget } from '../actions';

interface Line {
  budgetLineId: string;
  newAmount: string;
}

const EMPTY_LINE: Line = { budgetLineId: '', newAmount: '' };

/**
 * Frontend Completion (BUD.5's own recommended next checkpoint) —
 * `ReviseBudgetForm`, the direct continuation of the `/budgeting/[id]`
 * detail page: `POST /budgets/:id/revise` (`ReviseBudgetDto`, confirmed
 * directly) takes `reason: string` plus `lines: { budgetLineId,
 * newAmount }[]` (`ArrayMinSize(1)`) — this is `CreateBudgetForm`'s own
 * dynamic add/remove-line pattern reused directly, per BUD.5's own
 * recommendation, swapping `CreateBudgetForm`'s `accountId`/`period`
 * `Select` pair for a single line-picker `Select` (since a revision
 * targets one EXISTING `BudgetLine` by id, not a new account/period
 * combination).
 *
 * `lineOptions` is supplied by the parent page, not fetched here — built
 * from the same `budgetLineId -> "<account code> · Month N"` map
 * (`buildLineLabels`) the page already computes for its Revision/
 * Transfer history tables, so a line picked in this form's dropdown
 * reads identically to how that same line already appears in this
 * page's own history tables. No new fetch, no new backend call.
 *
 * Gated on `APPROVED` only (`BudgetingService.revise`'s own
 * `assertStatus`, confirmed directly) — `page.tsx` only renders this
 * component for that one status, the same "don't offer what the backend
 * would reject" posture every other row-action/form in this app already
 * follows (`SubmitBudgetButton`, `CloseBudgetButton`).
 *
 * `revise` applies immediately and self-approves server-side
 * (`BudgetingService.revise` creates the `BudgetRevision` with
 * `status: APPROVED` and writes each line's new `revisedAmount` in the
 * same transaction, confirmed directly) — there is no separate
 * approval step for a revision the way there is for the budget itself,
 * so this form has no extra confirmation step beyond the existing
 * pending/error posture every other write-form in this app already
 * uses.
 *
 * Unlike `CreateBudgetForm`, a line here is picked from a bounded,
 * already-known set (the budget's own existing lines) rather than a
 * large open registry — still built as a `Select`, per `Select`'s own
 * doc comment reasoning for a "small, fixed set of values," here fixed
 * to this one budget's own line count rather than the whole Chart of
 * Accounts.
 *
 * ADDENDUM (FE-10.24, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add change),
 * the same fix `CreateBudgetForm`'s own sibling ADDENDUM just applied.
 * Verified directly against this file's own current source before
 * fixing.
 */
export function ReviseBudgetForm({ budgetId, lineOptions }: { budgetId: string; lineOptions: SelectOption[] }) {
  const [reason, setReason] = React.useState('');
  const [lines, setLines] = React.useState<Line[]>([{ ...EMPTY_LINE }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await reviseBudget(budgetId, {
      reason,
      lines: lines.map((line) => ({
        budgetLineId: line.budgetLineId,
        newAmount: Number(line.newAmount),
      })),
    });

    setPending(false);
    if (result.ok) {
      setReason('');
      setLines([{ ...EMPTY_LINE }]);
    } else {
      setError(result.error ?? 'Failed to revise budget.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(4),
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required style={{ minWidth: '280px' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Changed lines</span>
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <Select
              label={`Line (change ${index + 1})`}
              value={line.budgetLineId}
              onChange={(e) => updateLine(index, 'budgetLineId', e.target.value)}
              options={lineOptions}
              placeholder="Select a line…"
              required
              style={{ minWidth: '240px' }}
            />
            <TextField
              label={`New amount (change ${index + 1})`}
              type="number"
              value={line.newAmount}
              onChange={(e) => updateLine(index, 'newAmount', e.target.value)}
              required
              style={{ minWidth: '160px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addLine}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add change
        </Button>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Revising…' : 'Submit revision'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
