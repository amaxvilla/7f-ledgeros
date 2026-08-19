'use client';

import * as React from 'react';
import { Button, Select, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { clockIn, clockOut } from './actions';

export function ClockInOutForm({ employeeOptions }: { employeeOptions: SelectOption[] }) {
  const [employeeId, setEmployeeId] = React.useState('');
  const [pending, setPending] = React.useState<'in' | 'out' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleClockIn() {
    if (!employeeId) {
      setError('Select an employee first.');
      return;
    }
    setPending('in');
    setError(null);
    setMessage(null);
    const result = await clockIn(employeeId, new Date().toISOString());
    setPending(null);
    if (result.ok) {
      setMessage('Clocked in.');
    } else {
      setError(result.error ?? 'Failed to clock in.');
    }
  }

  async function handleClockOut() {
    if (!employeeId) {
      setError('Select an employee first.');
      return;
    }
    setPending('out');
    setError(null);
    setMessage(null);
    const result = await clockOut(employeeId, new Date().toISOString());
    setPending(null);
    if (result.ok) {
      setMessage('Clocked out.');
    } else {
      setError(result.error ?? 'Failed to clock out.');
    }
  }

  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <Select
        label="Employee"
        value={employeeId}
        onChange={(e) => {
          setEmployeeId(e.target.value);
          setError(null);
          setMessage(null);
        }}
        options={employeeOptions}
        placeholder="Select an employee…"
        style={{ minWidth: '220px' }}
      />
      <Button type="button" disabled={pending !== null} onClick={handleClockIn}>
        {pending === 'in' ? 'Clocking in…' : 'Clock in'}
      </Button>
      <Button type="button" variant="secondary" disabled={pending !== null} onClick={handleClockOut}>
        {pending === 'out' ? 'Clocking out…' : 'Clock out'}
      </Button>
      {message && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>{message}</span>}
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
