'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createMortgageApplication } from './actions';

/**
 * Frontend Completion — Mortgage Management's data-entry form, following
 * every Create*Form's established pattern exactly (manual pending/error
 * useState, 'use client' form + 'use server' action split).
 *
 * allocationId stays a plain TextField (an id field, not a fixed set of
 * options) — same "id field vs. enum" distinction CreateTaxCodeForm's
 * own doc comment draws for taxAuthorityAccountId; there is no
 * dedicated allocation-picker UI yet (choosing a UnitSaleAllocation is
 * a Real Estate Sales page concern that doesn't exist yet either), so
 * the id is entered directly, same limitation CreateFixedAssetForm's
 * assetCategoryId already has.
 */
export function CreateMortgageApplicationForm({ entityId }: { entityId: string }) {
  const [allocationId, setAllocationId] = React.useState('');
  const [lenderName, setLenderName] = React.useState('');
  const [amountApplied, setAmountApplied] = React.useState('');
  const [interestRatePercent, setInterestRatePercent] = React.useState('');
  const [tenorMonths, setTenorMonths] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createMortgageApplication({
      entityId,
      allocationId,
      lenderName,
      amountApplied: Number(amountApplied),
      interestRatePercent: interestRatePercent ? Number(interestRatePercent) : undefined,
      tenorMonths: tenorMonths ? Number(tenorMonths) : undefined,
      notes: notes || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create mortgage application.');
      return;
    }
    setAllocationId('');
    setLenderName('');
    setAmountApplied('');
    setInterestRatePercent('');
    setTenorMonths('');
    setNotes('');
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
        label="Sale allocation ID"
        value={allocationId}
        onChange={(e) => setAllocationId(e.target.value)}
        placeholder="allocation UUID"
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Lender" value={lenderName} onChange={(e) => setLenderName(e.target.value)} required style={{ minWidth: '180px' }} />
      <TextField
        label="Amount applied"
        type="number"
        value={amountApplied}
        onChange={(e) => setAmountApplied(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Interest rate % (optional)"
        type="number"
        value={interestRatePercent}
        onChange={(e) => setInterestRatePercent(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Tenor months (optional)"
        type="number"
        value={tenorMonths}
        onChange={(e) => setTenorMonths(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minWidth: '200px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add mortgage application'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
