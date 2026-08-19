'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { initiateExit } from '../actions';

const EXIT_TYPE_OPTIONS = [
  { value: 'RESIGNATION', label: 'Resignation' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'END_OF_CONTRACT', label: 'End of contract' },
];

/**
 * Minimal exit-initiation slice: one clearance department with a
 * comma-separated list of checklist items, matching
 * `EmployeeLifecycleService.initiateExit`'s own requirement of "at
 * least one item across all departments" with the smallest form that
 * satisfies it. Multi-department clearance checklists (IT + Finance +
 * Facilities in one submission) are a real gap, deliberately left for
 * a follow-on rather than a sprawling dynamic-row form here.
 */
export function InitiateExitForm({ employeeId }: { employeeId: string }) {
  const [exitType, setExitType] = React.useState('');
  const [noticeDate, setNoticeDate] = React.useState('');
  const [lastWorkingDate, setLastWorkingDate] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [items, setItems] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const itemList = items
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!department || itemList.length === 0) {
      setPending(false);
      setError('Provide a department and at least one checklist item.');
      return;
    }

    const result = await initiateExit({
      employeeId,
      exitType,
      noticeDate,
      lastWorkingDate,
      reason: reason || undefined,
      clearanceChecklist: { [department]: itemList },
    });

    setPending(false);
    if (result.ok) {
      setOpen(false);
    } else {
      setError(result.error ?? 'Failed to initiate exit.');
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Initiate exit
      </Button>
    );
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
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Exit type"
        value={exitType}
        onChange={(e) => setExitType(e.target.value)}
        options={EXIT_TYPE_OPTIONS}
        placeholder="Select…"
        required
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Notice date"
        type="date"
        value={noticeDate}
        onChange={(e) => setNoticeDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Last working date"
        type="date"
        value={lastWorkingDate}
        onChange={(e) => setLastWorkingDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Clearance department"
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        placeholder="e.g. IT"
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Checklist items (comma-separated)"
        value={items}
        onChange={(e) => setItems(e.target.value)}
        placeholder="Return laptop, Return ID card"
        required
        style={{ minWidth: '260px' }}
      />
      <TextField
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Confirm exit'}
      </Button>
      <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
