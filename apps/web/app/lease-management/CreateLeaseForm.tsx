'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createLease } from './actions';

const RENT_FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Annually' },
];

/**
 * Frontend Completion — fifth data-entry form, following
 * CreateTenantForm (Checkpoint Q), CreateLeadForm, CreateTaxCodeForm,
 * and CreateFixedAssetForm's pattern exactly (see any of their own doc
 * comments for the shared conventions: manual pending/error useState,
 * 'use client' form + 'use server' action split, reset-on-success).
 *
 * `rentFrequency` uses Select (Checkpoint U) from the start, not a
 * TextField later upgraded — LeaseRentFrequency is a real fixed
 * three-value Prisma enum (MONTHLY/QUARTERLY/ANNUALLY, same `@IsIn`
 * shape CreateTaxCodeDto's own taxType has), and Select already existed
 * by the time this form was built, so there was no "simplest correct
 * version first" tradeoff to make here the way there was for
 * CreateTaxCodeForm's taxType or CreateLeadForm's source. Optional
 * (CreateLeaseDto's own `rentFrequency?`), so a placeholder option is
 * shown and the field isn't `required`, unlike Tax Type.
 *
 * `tenantId`/`unitId` stay plain TextFields (ids from other registries
 * — Tenant, Unit — not fixed enums), the same "id field, not an enum"
 * reasoning CreateFixedAssetForm's own assetCategoryId doc comment
 * gives.
 */
export function CreateLeaseForm({ entityId }: { entityId: string }) {
  const [tenantId, setTenantId] = React.useState('');
  const [unitId, setUnitId] = React.useState('');
  const [leaseNumber, setLeaseNumber] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [rentAmount, setRentAmount] = React.useState('');
  const [rentFrequency, setRentFrequency] = React.useState('');
  const [depositAmount, setDepositAmount] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createLease({
      entityId,
      tenantId,
      unitId,
      leaseNumber,
      startDate,
      endDate,
      rentAmount: Number(rentAmount),
      rentFrequency: rentFrequency || undefined,
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create lease.');
      return;
    }
    setTenantId('');
    setUnitId('');
    setLeaseNumber('');
    setStartDate('');
    setEndDate('');
    setRentAmount('');
    setRentFrequency('');
    setDepositAmount('');
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
      <TextField label="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Unit ID" value={unitId} onChange={(e) => setUnitId(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField
        label="Lease #"
        value={leaseNumber}
        onChange={(e) => setLeaseNumber(e.target.value)}
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
        label="End date"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Rent amount"
        type="number"
        value={rentAmount}
        onChange={(e) => setRentAmount(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <Select
        label="Rent frequency"
        value={rentFrequency}
        onChange={(e) => setRentFrequency(e.target.value)}
        options={RENT_FREQUENCY_OPTIONS}
        placeholder="Default (monthly)"
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Deposit (optional)"
        type="number"
        value={depositAmount}
        onChange={(e) => setDepositAmount(e.target.value)}
        style={{ minWidth: '140px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add lease'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
