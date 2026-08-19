'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { addSuccessionCandidate } from './actions';

const READINESS_OPTIONS: SelectOption[] = [
  { value: 'READY_NOW', label: 'Ready now' },
  { value: 'READY_1_2_YEARS', label: 'Ready in 1–2 years' },
  { value: 'READY_3_PLUS_YEARS', label: 'Ready in 3+ years' },
];

export function AddCandidateForm({
  planOptions,
  employeeOptions,
}: {
  planOptions: SelectOption[];
  employeeOptions: SelectOption[];
}) {
  const [planId, setPlanId] = React.useState('');
  const [employeeId, setEmployeeId] = React.useState('');
  const [readiness, setReadiness] = React.useState('');
  const [highPotential, setHighPotential] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!planId || !employeeId) {
      setError('Select a succession plan and employee.');
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    const result = await addSuccessionCandidate({
      successionPlanId: planId,
      employeeId,
      readiness: readiness || undefined,
      isHighPotential: highPotential,
      developmentNotes: notes.trim() || undefined,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEmployeeId('');
    setReadiness('');
    setHighPotential(false);
    setNotes('');
    setSuccess('Candidate added.');
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
      <Select label="Succession plan" value={planId} onChange={(event) => setPlanId(event.target.value)} options={planOptions} placeholder="Select plan" />
      <Select label="Employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} options={employeeOptions} placeholder="Select employee" />
      <Select label="Readiness" value={readiness} onChange={(event) => setReadiness(event.target.value)} options={READINESS_OPTIONS} placeholder="Select readiness" />
      <TextField label="Development notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: tokens.space(2), fontFamily: tokens.font.body, fontSize: '13px' }}>
        <input type="checkbox" checked={highPotential} onChange={(event) => setHighPotential(event.target.checked)} />
        High-potential candidate
      </label>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add candidate'}
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
