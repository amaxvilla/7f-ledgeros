'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createProject } from './actions';

/**
 * Frontend Completion, FE-3.2 — follows `CreateTaxCodeForm`'s
 * established shape (manual pending/error `useState`, `'use client'`
 * form + `'use server'` action split). Unlike `CreateVendorForm`/
 * `CreateCustomerForm` below, this one DOES take an `entityId` prop —
 * `CreateProjectDto`-shaped body requires it (`Project.entityId` is a
 * real column, confirmed against `schema.prisma`) — sourced from the
 * page's `EntitySelector`-driven `searchParams`, the same "prop, not a
 * field typed in twice" shape `CreateBoqForm`'s own `entityId` prop
 * uses.
 */
export function CreateProjectForm({ entityId }: { entityId: string }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createProject({
      entityId,
      code,
      name,
      description: description || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create project.');
      return;
    }
    setCode('');
    setName('');
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
    >
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ minWidth: '120px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ minWidth: '260px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add project'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
