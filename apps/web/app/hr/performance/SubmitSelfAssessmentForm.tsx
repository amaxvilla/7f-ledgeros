'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { submitSelfAssessment } from './actions';

export function SubmitSelfAssessmentForm({
  employeeOptions,
  cycleOptions,
}: {
  employeeOptions: SelectOption[];
  cycleOptions: SelectOption[];
}) {
  const [employeeId, setEmployeeId] = React.useState('');
  const [cycleId, setCycleId] = React.useState('');
  const [selfRating, setSelfRating] = React.useState('');
  const [selfComments, setSelfComments] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const result = await submitSelfAssessment({
      employeeId,
      cycleId,
      selfRating: Number(selfRating),
      selfComments: selfComments || undefined,
    });

    setPending(false);
    if (result.ok) {
      setMessage('Self-assessment submitted — review is now in progress for this employee.');
      setSelfRating('');
      setSelfComments('');
    } else {
      setError(result.error ?? 'Failed to submit self-assessment.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <Select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} options={employeeOptions} placeholder="Select…" required style={{ minWidth: '220px' }} />
      <Select label="Cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)} options={cycleOptions} placeholder="Select…" required style={{ minWidth: '180px' }} />
      <TextField label="Self rating (1-5)" type="number" value={selfRating} onChange={(e) => setSelfRating(e.target.value)} required style={{ minWidth: '120px' }} />
      <TextField label="Comments (optional)" value={selfComments} onChange={(e) => setSelfComments(e.target.value)} style={{ minWidth: '220px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit self-assessment'}
      </Button>
      {message && <div style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>{message}</div>}
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
