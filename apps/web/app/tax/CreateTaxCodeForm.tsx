'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createTaxCode } from './actions';

const TAX_TYPE_OPTIONS = [
  { value: 'WHT', label: 'WHT — Withholding Tax' },
  { value: 'VAT', label: 'VAT — Value Added Tax' },
];

/**
 * Frontend Completion — third data-entry form, following
 * CreateTenantForm (Checkpoint Q) and CreateLeadForm's pattern exactly
 * (see either's own doc comment for the shared conventions: manual
 * pending/error useState, 'use client' form + 'use server' action
 * split, plain-text-input simplification for enum/id fields).
 *
 * `taxType` upgraded from a plain TextField to Select once @7f/ui grew
 * a Select primitive (see that component's own doc comment — this form
 * is one of the two it named as the motivating gap). TaxType is a real
 * two-value Prisma enum (WHT/VAT), unlike `jurisdiction`/
 * `taxAuthorityAccountId` below, which stay TextFields: jurisdiction is
 * genuinely free text (no fixed set of Nigerian tax jurisdictions
 * modeled anywhere in this schema) and taxAuthorityAccountId is a GL
 * account id, the same "id field, not an enum" case
 * CreateFixedAssetForm's own assetCategoryId is still left as a
 * TextField for (a dynamic lookup, not a fixed set — Select's own doc
 * comment is explicit that upgrading that one is a separate, later
 * checkpoint, not automatic just because Select now exists).
 *
 * The one genuinely new thing here: no `entityId` prop at all.
 * CreateTaxCodeDto has no entityId field — TaxCode is shared reference
 * data across every entity (see tax/page.tsx's own doc comment on why
 * its table render isn't entityId-gated either) — so this form doesn't
 * need one either, unlike its two predecessors. Confirms the pattern
 * generalizes to a genuinely entity-agnostic domain, not just ones that
 * happen to look similar to Tenants/Leads.
 */
export function CreateTaxCodeForm() {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [taxType, setTaxType] = React.useState('');
  const [rate, setRate] = React.useState('');
  const [jurisdiction, setJurisdiction] = React.useState('');
  const [taxAuthorityAccountId, setTaxAuthorityAccountId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createTaxCode({
      code,
      name,
      taxType,
      rate: Number(rate),
      jurisdiction: jurisdiction || undefined,
      taxAuthorityAccountId,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create tax code.');
      return;
    }
    setCode('');
    setName('');
    setTaxType('');
    setRate('');
    setJurisdiction('');
    setTaxAuthorityAccountId('');
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
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ minWidth: '120px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '200px' }} />
      <Select
        label="Tax type"
        value={taxType}
        onChange={(e) => setTaxType(e.target.value)}
        options={TAX_TYPE_OPTIONS}
        placeholder="Select a tax type…"
        required
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Rate"
        type="number"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        placeholder="0.05 = 5%"
        required
        style={{ minWidth: '120px' }}
      />
      <TextField
        label="Jurisdiction (optional)"
        value={jurisdiction}
        onChange={(e) => setJurisdiction(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Tax authority GL account ID"
        value={taxAuthorityAccountId}
        onChange={(e) => setTaxAuthorityAccountId(e.target.value)}
        placeholder="account UUID"
        required
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add tax code'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
