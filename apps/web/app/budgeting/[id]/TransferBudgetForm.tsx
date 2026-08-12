'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { formatCurrency } from '../../../lib/format';
import { transferBudget } from '../actions';

/**
 * Frontend Completion (BUD.6's own recommended next checkpoint) —
 * `TransferBudgetForm`, the second of the two form-shaped features
 * BUD.5's own report estimated for this detail page. `POST
 * /budgets/:id/transfer` (`TransferBudgetDto`, confirmed directly
 * against `BudgetingService.transfer`) takes a flat `{ fromLineId,
 * toLineId, amount, reason }` — genuinely NOT `ReviseBudgetForm`'s
 * array-of-changes shape (`revise` can touch many lines in one call;
 * `transfer` always moves one amount between exactly two), so this is a
 * single-row form, closer to `CreateAPInvoiceForm`'s own flat header
 * fields than to `CreateBudgetForm`/`ReviseBudgetForm`'s dynamic line
 * arrays. No add/remove-row UI needed here.
 *
 * Gated on `APPROVED` only (`BudgetingService.transfer`'s own
 * `assertStatus`, confirmed directly — identical to `revise`'s gate) —
 * `page.tsx` renders this alongside `ReviseBudgetForm` under the same
 * status condition. Requires `budget.transfer` — confirmed directly
 * against `BudgetingController.transfer`'s own `@RequirePermissions`
 * decorator to be a DIFFERENT permission from `revise`'s
 * `budget.manage`, not assumed identical; enforced server-side only
 * (same posture every other form in this app already takes — no
 * client-side permission check anywhere in this codebase).
 *
 * `fromLineId`/`toLineId` are two independent `Select`s built from the
 * same `lineOptions` prop `ReviseBudgetForm` already uses (`page.tsx`'s
 * own `lineLabels` map) — no new fetch. `BudgetingService.transfer`
 * itself already rejects `fromLineId === toLineId` server-side
 * (confirmed directly, a `BadRequestException`), so this form adds only
 * a matching CLIENT-side guard (blocks submission with an inline error,
 * no network round-trip) rather than filtering either Select's own
 * option list — filtering would mean re-deriving each dropdown's
 * options per keystroke of the other, for a case the backend already
 * guards correctly; the simpler guard was chosen deliberately, the same
 * "check before any network round-trip" posture `PostAPInvoiceButton`'s
 * own no-account-selected guard already established.
 *
 * `availableByLineId` (also caller-supplied, built directly from
 * `variance.lines[].available` — the exact figure
 * `BudgetingService.transfer`'s own `getAvailableForLine` computes
 * server-side, confirmed directly to be the same formula) is shown as
 * helper text under the From-line Select once a line is picked, so the
 * user sees the real transferable ceiling before hitting the server's
 * own "Insufficient available budget" rejection — no new fetch, this
 * page already has `variance` in scope.
 */
export function TransferBudgetForm({
  budgetId,
  lineOptions,
  availableByLineId,
}: {
  budgetId: string;
  lineOptions: SelectOption[];
  availableByLineId: Map<string, number>;
}) {
  const [fromLineId, setFromLineId] = React.useState('');
  const [toLineId, setToLineId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (fromLineId === toLineId) {
      setError('The from-line and to-line must be different.');
      return;
    }

    setPending(true);
    const result = await transferBudget(budgetId, {
      fromLineId,
      toLineId,
      amount: Number(amount),
      reason,
    });

    setPending(false);
    if (result.ok) {
      setFromLineId('');
      setToLineId('');
      setAmount('');
      setReason('');
    } else {
      setError(result.error ?? 'Failed to transfer budget.');
    }
  }

  const fromAvailable = fromLineId ? availableByLineId.get(fromLineId) : undefined;

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
          <Select
            label="From line"
            value={fromLineId}
            onChange={(e) => setFromLineId(e.target.value)}
            options={lineOptions}
            placeholder="Select a line…"
            required
            style={{ minWidth: '220px' }}
          />
          {fromAvailable !== undefined && (
            <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>
              Available: {formatCurrency(fromAvailable)}
            </span>
          )}
        </div>
        <Select
          label="To line"
          value={toLineId}
          onChange={(e) => setToLineId(e.target.value)}
          options={lineOptions}
          placeholder="Select a line…"
          required
          style={{ minWidth: '220px' }}
        />
        <TextField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ minWidth: '140px' }} />
        <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required style={{ minWidth: '220px' }} />
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Transferring…' : 'Submit transfer'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
