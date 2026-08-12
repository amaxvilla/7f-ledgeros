'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createEntity } from './actions';

const CONSOLIDATION_OPTIONS = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
];

/**
 * Frontend Completion, FE-8.2 — `parentEntityId` is a real `Select`
 * (built from the same fetched entity list `page.tsx` already has in
 * hand for the register, no second fetch — the same "reuse what's
 * already in hand" shape `taskOptions`/`parcelOptions`/`linkOptions`
 * all already established elsewhere in this app) with an explicit
 * "No parent (top-level entity)" placeholder rather than defaulting to
 * the first real entity in the list. `isConsolidationParent` uses
 * `Select`, the same "no checkbox primitive" convention every other
 * boolean field in this app has used. `baseCurrency`/
 * `fiscalYearStartMonth` are left as plain optional fields (a currency
 * code and a 1–12 month number) — server-defaulted when blank, see
 * `actions.ts`'s own doc comment.
 */
export function CreateEntityForm({ parentOptions }: { parentOptions: SelectOption[] }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [legalName, setLegalName] = React.useState('');
  const [taxIdentificationNumber, setTaxIdentificationNumber] = React.useState('');
  const [registrationNumber, setRegistrationNumber] = React.useState('');
  const [baseCurrency, setBaseCurrency] = React.useState('');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = React.useState('');
  const [parentEntityId, setParentEntityId] = React.useState('');
  const [isConsolidationParent, setIsConsolidationParent] = React.useState('false');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createEntity({
      code,
      name,
      legalName,
      taxIdentificationNumber: taxIdentificationNumber || undefined,
      registrationNumber: registrationNumber || undefined,
      baseCurrency: baseCurrency || undefined,
      fiscalYearStartMonth: fiscalYearStartMonth === '' ? undefined : Number(fiscalYearStartMonth),
      parentEntityId: parentEntityId || undefined,
      isConsolidationParent: isConsolidationParent === 'true',
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create entity.');
      return;
    }
    setCode('');
    setName('');
    setLegalName('');
    setTaxIdentificationNumber('');
    setRegistrationNumber('');
    setBaseCurrency('');
    setFiscalYearStartMonth('');
    setParentEntityId('');
    setIsConsolidationParent('false');
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
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 7FIL" required style={{ minWidth: '120px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Legal name" value={legalName} onChange={(e) => setLegalName(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField
        label="Tax ID (optional)"
        value={taxIdentificationNumber}
        onChange={(e) => setTaxIdentificationNumber(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Registration number (optional)"
        value={registrationNumber}
        onChange={(e) => setRegistrationNumber(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Base currency (optional)"
        value={baseCurrency}
        onChange={(e) => setBaseCurrency(e.target.value)}
        placeholder="NGN"
        style={{ minWidth: '130px' }}
      />
      <TextField
        label="Fiscal year start month (optional)"
        type="number"
        min={1}
        max={12}
        value={fiscalYearStartMonth}
        onChange={(e) => setFiscalYearStartMonth(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Parent entity (optional)"
        value={parentEntityId}
        onChange={(e) => setParentEntityId(e.target.value)}
        options={parentOptions}
        placeholder="No parent (top-level entity)"
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Consolidation parent"
        value={isConsolidationParent}
        onChange={(e) => setIsConsolidationParent(e.target.value)}
        options={CONSOLIDATION_OPTIONS}
        style={{ minWidth: '110px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add entity'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
