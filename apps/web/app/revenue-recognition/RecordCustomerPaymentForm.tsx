'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { recordCustomerPayment } from './actions';

/**
 * Frontend Completion, FE-3.5 — not gated behind `EntitySelector`; see
 * `actions.ts`'s own doc comment for why `recordCustomerPayment` takes
 * no `entityId` at all (derived server-side from `installmentLineId`).
 * On success this shows an inline confirmation rather than calling
 * `revalidatePath` the way every mutating action elsewhere in this
 * codebase does — there's no list on this page for a revalidate to
 * refresh (see `actions.ts`'s own doc comment on why this whole module
 * has no `GET` routes), so a client-side success message is the
 * correct — and only meaningful — feedback here.
 */
export function RecordCustomerPaymentForm({ accountOptions }: { accountOptions: SelectOption[] }) {
  const [installmentLineId, setInstallmentLineId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [entryDate, setEntryDate] = React.useState('');
  const [bankAccountGlId, setBankAccountGlId] = React.useState('');
  const [deferredRevenueGlId, setDeferredRevenueGlId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await recordCustomerPayment({
      installmentLineId,
      amount: Number(amount),
      entryDate,
      bankAccountGlId,
      deferredRevenueGlId,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to record customer payment.');
      return;
    }
    setInstallmentLineId('');
    setAmount('');
    setEntryDate('');
    setBankAccountGlId('');
    setDeferredRevenueGlId('');
    setSuccess(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField
        label="Installment line ID"
        value={installmentLineId}
        onChange={(e) => setInstallmentLineId(e.target.value)}
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ minWidth: '140px' }} />
      <TextField label="Entry date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required style={{ minWidth: '160px' }} />
      <Select
        label="Bank/cash GL account"
        value={bankAccountGlId}
        onChange={(e) => setBankAccountGlId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Deferred revenue GL account"
        value={deferredRevenueGlId}
        onChange={(e) => setDeferredRevenueGlId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record payment'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {success && (
        <div style={{ width: '100%', color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Payment recorded and posted to deferred revenue.
        </div>
      )}
    </form>
  );
}
