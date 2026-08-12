'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createFixedAsset } from './actions';

/**
 * Frontend Completion — fourth data-entry form, following
 * CreateTenantForm (Checkpoint Q), CreateLeadForm, and
 * CreateTaxCodeForm's pattern exactly (see any of their own doc
 * comments for the shared conventions: manual pending/error useState,
 * 'use client' form + 'use server' action split, plain-text-input
 * simplification for id/enum fields, reset-on-success).
 *
 * `assetCategoryId` is a plain TextField for the AssetCategory's id
 * (a UUID a user pastes in), not a dropdown populated from
 * `GET /fixed-assets/categories` — the same "ship the simplest correct
 * field first" precedent CreateLeadForm's own doc comment already
 * established for `source`, not a new decision made here. A future
 * checkpoint adding Select to @7f/ui (or a category-lookup fetch on
 * this page) can upgrade this field without touching this form's
 * submit logic.
 *
 * Takes `entityId` as a required prop, matching CreateTenantForm/
 * CreateLeadForm (not CreateTaxCodeForm, which has none — see that
 * form's own doc comment for why FixedAsset needs one and TaxCode
 * doesn't).
 */
export function CreateFixedAssetForm({ entityId }: { entityId: string }) {
  const [assetCategoryId, setAssetCategoryId] = React.useState('');
  const [assetTag, setAssetTag] = React.useState('');
  const [name, setName] = React.useState('');
  const [acquisitionDate, setAcquisitionDate] = React.useState('');
  const [acquisitionCost, setAcquisitionCost] = React.useState('');
  const [usefulLifeYears, setUsefulLifeYears] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createFixedAsset({
      entityId,
      assetCategoryId,
      assetTag,
      name,
      acquisitionDate,
      acquisitionCost: Number(acquisitionCost),
      usefulLifeYears: Number(usefulLifeYears),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create fixed asset.');
      return;
    }
    setAssetCategoryId('');
    setAssetTag('');
    setName('');
    setAcquisitionDate('');
    setAcquisitionCost('');
    setUsefulLifeYears('');
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
        label="Asset category ID"
        value={assetCategoryId}
        onChange={(e) => setAssetCategoryId(e.target.value)}
        placeholder="category UUID"
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Asset tag" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} required style={{ minWidth: '140px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField
        label="Acquisition date"
        type="date"
        value={acquisitionDate}
        onChange={(e) => setAcquisitionDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Acquisition cost"
        type="number"
        value={acquisitionCost}
        onChange={(e) => setAcquisitionCost(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Useful life (years)"
        type="number"
        value={usefulLifeYears}
        onChange={(e) => setUsefulLifeYears(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add fixed asset'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
