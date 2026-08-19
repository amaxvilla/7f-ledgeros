'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createCourse } from './actions';

export function CreateCourseForm({ entityId }: { entityId: string }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [durationHours, setDurationHours] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createCourse({
      entityId,
      code,
      name,
      durationHours: durationHours ? Number(durationHours) : undefined,
      provider: provider || undefined,
    });

    setPending(false);
    if (result.ok) {
      setCode('');
      setName('');
      setDurationHours('');
      setProvider('');
    } else {
      setError(result.error ?? 'Failed to create course.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <TextField label="Course code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ minWidth: '140px' }} />
      <TextField label="Course name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField label="Duration (hours)" type="number" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} style={{ minWidth: '140px' }} />
      <TextField label="Provider (optional)" value={provider} onChange={(e) => setProvider(e.target.value)} style={{ minWidth: '180px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Add course'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
