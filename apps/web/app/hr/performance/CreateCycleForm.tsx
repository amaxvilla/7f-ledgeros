'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createCycle } from './actions';

export function CreateCycleForm({ entityId }: { entityId: string }) {
  const [name, setName] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createCycle({ entityId, name, startDate, endDate });
    setPending(false);
    if (result.ok) {
      setName('');
      setStartDate('');
      setEndDate('');
    } else {
      setError(result.error ?? 'Failed to create cycle.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <TextField label="Cycle name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. H1 2026" required style={{ minWidth: '200px' }} />
      <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required style={{ minWidth: '160px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create cycle'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
