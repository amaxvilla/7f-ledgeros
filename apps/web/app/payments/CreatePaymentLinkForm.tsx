'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createPaymentLink } from './actions';

const PROVIDER_OPTIONS = [
  { value: 'PAYSTACK', label: 'Paystack' },
  { value: 'FLUTTERWAVE', label: 'Flutterwave' },
];

/**
 * Frontend Completion — ninth data-entry form, following
 * CreateVacancyForm and every form since Checkpoint Q (see any of their
 * own doc comments for the shared conventions: manual pending/error
 * useState, 'use client' form + 'use server' action split, reset-on-
 * success). The second form added to a page that predates the
 * form-per-page convention — Payments (Checkpoint C) was read-only
 * until now, same as Recruitment was before CreateVacancyForm.
 *
 * `providerCode` uses Select, not a plain TextField — unlike
 * CreateVacancyForm's own jobRequisitionId (an open-ended id from
 * another registry), PaymentProviderRegistry today has exactly two
 * concrete registered providers (PAYSTACK, FLUTTERWAVE — see
 * paystack.provider.ts/flutterwave.provider.ts's own PROVIDER_CODE
 * constants), a real closed set in the same sense CreateIpRuleForm's
 * scope field and CreateLeaseForm's rentFrequency both are. A third
 * provider registering later would need this list extended by hand —
 * same tradeoff every other Select in this app already accepts for a
 * caller-supplied, not dynamically-fetched, option set (see Select's
 * own doc comment).
 *
 * `amount` is the one field here with real unit-conversion logic:
 * InitializePaymentDto requires an integer minor-unit amount (kobo,
 * cents), but this field collects a human-readable major-unit value
 * ("500.00", not "50000") and converts with `Math.round(Number(amount) * 100)`
 * before calling the action — see actions.ts's own doc comment for why
 * that conversion happens here rather than being pushed further down.
 * This assumes a 2-decimal-place currency, the same implicit assumption
 * payments/page.tsx's own formatMinorUnits() already makes for display.
 *
 * `metadata` is not a field on this form — see actions.ts's own doc
 * comment for why.
 */
export function CreatePaymentLinkForm({ entityId }: { entityId: string }) {
  const [providerCode, setProviderCode] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState('NGN');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createPaymentLink({
      entityId,
      providerCode,
      reference,
      amount: Math.round(Number(amount) * 100),
      currency,
      customerEmail,
      description: description || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to initialize payment.');
      return;
    }
    setProviderCode('');
    setReference('');
    setAmount('');
    setCustomerEmail('');
    setDescription('');
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
      aria-label={`Initialize payment for entity ${entityId}`}
    >
      <Select
        label="Provider"
        value={providerCode}
        onChange={(e) => setProviderCode(e.target.value)}
        options={PROVIDER_OPTIONS}
        placeholder="Select a provider…"
        required
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Reference"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="e.g. invoice-2026-0042"
        required
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Amount"
        type="number"
        step="0.001"
        min="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Currency"
        value={currency}
        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        maxLength={3}
        required
        style={{ minWidth: '90px' }}
      />
      <TextField
        label="Customer email"
        type="email"
        value={customerEmail}
        onChange={(e) => setCustomerEmail(e.target.value)}
        required
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Initializing…' : 'Generate payment link'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
