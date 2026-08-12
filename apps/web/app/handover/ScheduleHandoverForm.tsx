'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { scheduleHandover } from './actions';

/**
 * Frontend Completion, FE-4.1. Flat-field form matching
 * `ScheduleHandoverDto` exactly — `allocationId`/`unitId`/`customerId`
 * are all plain `TextField`s, not `Select`s, per this checkpoint's own
 * `actions.ts` doc comment on why (no list endpoint behind any of the
 * three).
 */
export function ScheduleHandoverForm({ entityId }: { entityId: string }) {
  const [allocationId, setAllocationId] = React.useState('');
  const [unitId, setUnitId] = React.useState('');
  const [customerId, setCustomerId] = React.useState('');
  const [scheduledDate, setScheduledDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await scheduleHandover({ allocationId, entityId, unitId, customerId, scheduledDate });

    setPending(false);
    if (result.ok) {
      setAllocationId('');
      setUnitId('');
      setCustomerId('');
      setScheduledDate('');
    } else {
      setError(result.error ?? 'Failed to schedule handover.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField
        label="Allocation ID"
        value={allocationId}
        onChange={(e) => setAllocationId(e.target.value)}
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Unit ID" value={unitId} onChange={(e) => setUnitId(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField
        label="Customer ID"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        required
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Scheduled date"
        type="date"
        value={scheduledDate}
        onChange={(e) => setScheduledDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Scheduling…' : 'Schedule handover'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
