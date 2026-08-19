'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { markAbsentees } from './actions';

export function MarkAbsenteesButton({ entityId }: { entityId: string }) {
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await markAbsentees(entityId, date);
    setPending(false);
    if (result.ok) {
      setMessage(`Marked ${result.marked ?? 0} employee(s) absent for ${date}.`);
    } else {
      setError(result.error ?? 'Failed to mark absentees.');
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
      <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ minWidth: '160px' }} />
      <Button type="button" variant="secondary" disabled={pending} onClick={handleClick}>
        {pending ? 'Marking…' : 'Mark absentees for this day'}
      </Button>
      {message && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>{message}</span>}
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
