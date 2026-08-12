'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createLoanFacility } from './actions';

/**
 * Frontend Completion — Treasury's data-entry form, following every
 * Create*Form's established pattern exactly (manual pending/error
 * useState, 'use client' form + 'use server' action split,
 * reset-on-success).
 *
 * `currency` defaults to `'NGN'` server-side (`TreasuryService.createLoanFacility`'s
 * own `dto.currency ?? 'NGN'`) — left optional here for the same reason
 * `CreateMortgageApplicationForm`'s own optional fields stay optional:
 * the backend default is authoritative, this form doesn't duplicate it.
 *
 * `startDate`/`maturityDate` use native `type="date"` inputs — the
 * service itself validates `maturityDate > startDate`
 * (`BadRequestException` otherwise), so this form doesn't duplicate
 * that check client-side, same posture every other form in this app
 * takes toward its own backend's validation.
 */
export function CreateLoanFacilityForm({ entityId }: { entityId: string }) {
  const [lenderName, setLenderName] = React.useState('');
  const [facilityAmount, setFacilityAmount] = React.useState('');
  const [currency, setCurrency] = React.useState('');
  const [interestRatePercent, setInterestRatePercent] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [maturityDate, setMaturityDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createLoanFacility({
      entityId,
      lenderName,
      facilityAmount: Number(facilityAmount),
      currency: currency || undefined,
      interestRatePercent: Number(interestRatePercent),
      startDate,
      maturityDate,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create loan facility.');
      return;
    }
    setLenderName('');
    setFacilityAmount('');
    setCurrency('');
    setInterestRatePercent('');
    setStartDate('');
    setMaturityDate('');
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
      <TextField label="Lender" value={lenderName} onChange={(e) => setLenderName(e.target.value)} required style={{ minWidth: '180px' }} />
      <TextField
        label="Facility amount"
        type="number"
        value={facilityAmount}
        onChange={(e) => setFacilityAmount(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Currency (optional)"
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        placeholder="NGN"
        style={{ minWidth: '100px' }}
      />
      <TextField
        label="Interest rate %"
        type="number"
        value={interestRatePercent}
        onChange={(e) => setInterestRatePercent(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Start date"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Maturity date"
        type="date"
        value={maturityDate}
        onChange={(e) => setMaturityDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add loan facility'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
