'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { requestLeave } from './actions';

export function CreateLeaveRequestForm({
  employeeOptions,
  leaveTypeOptions,
}: {
  employeeOptions: SelectOption[];
  leaveTypeOptions: SelectOption[];
}) {
  const [employeeId, setEmployeeId] = React.useState('');
  const [leaveTypeId, setLeaveTypeId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await requestLeave({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason: reason || undefined,
    });

    setPending(false);
    if (result.ok) {
      setEmployeeId('');
      setLeaveTypeId('');
      setStartDate('');
      setEndDate('');
      setReason('');
    } else {
      setError(result.error ?? 'Failed to submit leave request.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <Select
        label="Employee"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        options={employeeOptions}
        placeholder="Select an employee…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Leave type"
        value={leaveTypeId}
        onChange={(e) => setLeaveTypeId(e.target.value)}
        options={leaveTypeOptions}
        placeholder="Select a leave type…"
        required
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Start date"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="End date"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Request leave'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
