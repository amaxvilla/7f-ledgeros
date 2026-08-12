'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createEstate } from './actions';

/**
 * Frontend Completion, FE-4.6 — Estates, the prerequisite FE-4.5's own
 * report named before Estate Master Planning could be scoped: this
 * checkpoint confirmed directly that `GET`/`POST /real-estate/estates`
 * (`RealEstateController`, NOT `LandBankController` — a different
 * module, `realestate.view`/`realestate.manage` rather than
 * `landbank.*`) already exist, so no backend work was needed this time,
 * unlike FE-4.5's own one-line `getParcel` addition.
 *
 * Same manual-`useState` shape `CreateParcelForm` already established
 * for this same page. `RealEstateController.createEstate` takes a
 * plain inline body type, not a dedicated DTO class (confirmed
 * directly — `@Body() body: { entityId, code, name, description?,
 * location? }`), so this form's own optional fields mirror that shape
 * exactly rather than a DTO this checkpoint would otherwise read.
 */
export function CreateEstateForm({ entityId }: { entityId: string }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createEstate({
      entityId,
      code,
      name,
      description: description || undefined,
      location: location || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create estate.');
      return;
    }
    setCode('');
    setName('');
    setDescription('');
    setLocation('');
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
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ minWidth: '220px' }}
      />
      <TextField label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} style={{ minWidth: '200px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add estate'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
