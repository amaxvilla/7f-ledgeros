'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createSuccessionPlan } from './actions';

const CRITICALITY_OPTIONS: SelectOption[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export function CreateSuccessionPlanForm({
  entityId,
  employeeOptions,
}: {
  entityId: string;
  employeeOptions: SelectOption[];
}) {
  const [positionTitle, setPositionTitle] = React.useState('');
  const [incumbentEmployeeId, setIncumbentEmployeeId] = React.useState('');
  const [criticality, setCriticality] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!positionTitle.trim()) {
      setError('Enter the position title.');
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    const result = await createSuccessionPlan({
      entityId,
      positionTitle: positionTitle.trim(),
      incumbentEmployeeId: incumbentEmployeeId || undefined,
      criticality: criticality || undefined,
      notes: notes.trim() || undefined,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPositionTitle('');
    setIncumbentEmployeeId('');
    setCriticality('');
    setNotes('');
    setSuccess('Succession plan created.');
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: tokens.space(3),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.space(8),
      }}
    >
      <TextField label="Position title" value={positionTitle} onChange={(event) => setPositionTitle(event.target.value)} required />
      <Select label="Current incumbent" value={incumbentEmployeeId} onChange={(event) => setIncumbentEmployeeId(event.target.value)} options={employeeOptions} placeholder="Optional" />
      <Select label="Criticality" value={criticality} onChange={(event) => setCriticality(event.target.value)} options={CRITICALITY_OPTIONS} placeholder="Select criticality" />
      <TextField label="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create plan'}
        </Button>
      </div>
      {(error || success) && (
        <div style={{ gridColumn: '1 / -1', color: error ? tokens.color.negative : tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>
          {error ?? success}
        </div>
      )}
    </form>
  );
}
