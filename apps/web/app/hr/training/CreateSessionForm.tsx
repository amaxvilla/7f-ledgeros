'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createSession } from './actions';

export function CreateSessionForm({ courseOptions }: { courseOptions: SelectOption[] }) {
  const [courseId, setCourseId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createSession({ courseId, startDate, endDate, location: location || undefined });

    setPending(false);
    if (result.ok) {
      setCourseId('');
      setStartDate('');
      setEndDate('');
      setLocation('');
    } else {
      setError(result.error ?? 'Failed to schedule session.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <Select label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)} options={courseOptions} placeholder="Select a course…" required style={{ minWidth: '220px' }} />
      <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} style={{ minWidth: '180px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Scheduling…' : 'Schedule session'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
