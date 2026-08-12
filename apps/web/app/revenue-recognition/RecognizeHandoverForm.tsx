'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { recognizeHandoverRevenue } from './actions';

/**
 * Frontend Completion, FE-3.5 — gated on `entityId` (a prop, sourced
 * from the page's `EntitySelector`), unlike `RecordCustomerPaymentForm`
 * above — see `actions.ts`'s own doc comment for why the two endpoints
 * differ here. Same "inline success message, no revalidate" reasoning
 * as that sibling form.
 */
export function RecognizeHandoverForm({ entityId, accountOptions }: { entityId: string; accountOptions: SelectOption[] }) {
  const [unitId, setUnitId] = React.useState('');
  const [entryDate, setEntryDate] = React.useState('');
  const [salePrice, setSalePrice] = React.useState('');
  const [costOfUnit, setCostOfUnit] = React.useState('');
  const [deferredRevenueGlId, setDeferredRevenueGlId] = React.useState('');
  const [propertySalesRevenueGlId, setPropertySalesRevenueGlId] = React.useState('');
  const [costOfSalesGlId, setCostOfSalesGlId] = React.useState('');
  const [propertyInventoryGlId, setPropertyInventoryGlId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await recognizeHandoverRevenue({
      entityId,
      unitId,
      entryDate,
      salePrice: Number(salePrice),
      costOfUnit: Number(costOfUnit),
      deferredRevenueGlId,
      propertySalesRevenueGlId,
      costOfSalesGlId,
      propertyInventoryGlId,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to recognize handover revenue.');
      return;
    }
    setUnitId('');
    setEntryDate('');
    setSalePrice('');
    setCostOfUnit('');
    setDeferredRevenueGlId('');
    setPropertySalesRevenueGlId('');
    setCostOfSalesGlId('');
    setPropertyInventoryGlId('');
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
      <TextField label="Unit ID" value={unitId} onChange={(e) => setUnitId(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Entry date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="Sale price" type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required style={{ minWidth: '140px' }} />
      <TextField label="Cost of unit" type="number" value={costOfUnit} onChange={(e) => setCostOfUnit(e.target.value)} required style={{ minWidth: '140px' }} />
      <Select
        label="Deferred revenue GL account"
        value={deferredRevenueGlId}
        onChange={(e) => setDeferredRevenueGlId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Property sales revenue GL account"
        value={propertySalesRevenueGlId}
        onChange={(e) => setPropertySalesRevenueGlId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Cost of sales GL account"
        value={costOfSalesGlId}
        onChange={(e) => setCostOfSalesGlId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Property inventory GL account"
        value={propertyInventoryGlId}
        onChange={(e) => setPropertyInventoryGlId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Recognizing…' : 'Recognize handover revenue'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {success && (
        <div style={{ width: '100%', color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Revenue recognized on handover.
        </div>
      )}
    </form>
  );
}
