'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createWarehouse } from './actions';

/**
 * Frontend Completion, FE-3.4 — same `CreateProjectForm`-shaped form
 * (manual `useState`, `entityId` prop, no status/workflow). See
 * `actions.ts`'s own doc comment on why `createWarehouse`'s body has
 * only three fields — the controller's own inline type has no more.
 */
export function CreateWarehouseForm({ entityId }: { entityId: string }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createWarehouse({ entityId, code, name });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create warehouse.');
      return;
    }
    setCode('');
    setName('');
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
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add warehouse'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
