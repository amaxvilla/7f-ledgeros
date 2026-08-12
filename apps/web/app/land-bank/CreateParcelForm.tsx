'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createParcel } from './actions';

/**
 * Frontend Completion, FE-4.1 — same `CreateProjectForm`-shaped form
 * (manual `useState`, `entityId` prop). `stateProvince`/
 * `localGovernmentArea` both stay plain optional `TextField`s — both
 * are free-form strings on the DTO, not enums or ids into another
 * table (confirmed directly against `CreateLandParcelDto`).
 */
export function CreateParcelForm({ entityId }: { entityId: string }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [stateProvince, setStateProvince] = React.useState('');
  const [localGovernmentArea, setLocalGovernmentArea] = React.useState('');
  const [areaSqm, setAreaSqm] = React.useState('');
  const [acquisitionCostBudget, setAcquisitionCostBudget] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createParcel({
      entityId,
      code,
      name,
      location: location || undefined,
      stateProvince: stateProvince || undefined,
      localGovernmentArea: localGovernmentArea || undefined,
      areaSqm: Number(areaSqm),
      acquisitionCostBudget: acquisitionCostBudget ? Number(acquisitionCostBudget) : undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create land parcel.');
      return;
    }
    setCode('');
    setName('');
    setLocation('');
    setStateProvince('');
    setLocalGovernmentArea('');
    setAreaSqm('');
    setAcquisitionCostBudget('');
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
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} style={{ minWidth: '200px' }} />
      <TextField label="State/province (optional)" value={stateProvince} onChange={(e) => setStateProvince(e.target.value)} style={{ minWidth: '160px' }} />
      <TextField
        label="Local government area (optional)"
        value={localGovernmentArea}
        onChange={(e) => setLocalGovernmentArea(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <TextField label="Area (sqm)" type="number" value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} required style={{ minWidth: '140px' }} />
      <TextField
        label="Acquisition cost budget (optional)"
        type="number"
        value={acquisitionCostBudget}
        onChange={(e) => setAcquisitionCostBudget(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add parcel'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
