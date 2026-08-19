'use client';

import * as React from 'react';
import { Button, Select, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { enrol } from './actions';

export function EnrolForm({ employeeOptions, sessionOptions }: { employeeOptions: SelectOption[]; sessionOptions: SelectOption[] }) {
  const [employeeId, setEmployeeId] = React.useState('');
  const [sessionId, setSessionId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await enrol(sessionId, employeeId);

    setPending(false);
    if (result.ok) {
      setEmployeeId('');
      setSessionId('');
    } else {
      setError(result.error ?? 'Failed to enrol employee.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <Select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} options={employeeOptions} placeholder="Select…" required style={{ minWidth: '220px' }} />
      <Select label="Session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} options={sessionOptions} placeholder="Select…" required style={{ minWidth: '260px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Enrolling…' : 'Enrol'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
