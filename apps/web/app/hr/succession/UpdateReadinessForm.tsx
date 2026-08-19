'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { updateSuccessionReadiness } from './actions';

const READINESS_OPTIONS: SelectOption[] = [
  { value: 'READY_NOW', label: 'Ready now' },
  { value: 'READY_1_2_YEARS', label: 'Ready in 1–2 years' },
  { value: 'READY_3_PLUS_YEARS', label: 'Ready in 3+ years' },
];

export function UpdateReadinessForm({
  candidateId,
  initialReadiness,
  initialNotes,
}: {
  candidateId: string;
  initialReadiness: string;
  initialNotes?: string | null;
}) {
  const [readiness, setReadiness] = React.useState(initialReadiness);
  const [notes, setNotes] = React.useState(initialNotes ?? '');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();

    setPending(true);
    setError(null);
    setSuccess(null);

    const result = await updateSuccessionReadiness(
      candidateId,
      readiness,
      notes.trim() || undefined,
    );

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess('Readiness updated.');
  }

  return (
    <form
      onSubmit={save}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 2fr) auto',
        gap: tokens.space(2),
        alignItems: 'end',
        marginTop: tokens.space(2),
      }}
    >
      <Select label="Readiness" value={readiness} onChange={(event) => setReadiness(event.target.value)} options={READINESS_OPTIONS} />
      <TextField label="Development notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? 'Saving…' : 'Save'}
      </Button>
      {(error || success) && (
        <div style={{ gridColumn: '1 / -1', color: error ? tokens.color.negative : tokens.color.positive, fontFamily: tokens.font.body, fontSize: '12px' }}>
          {error ?? success}
        </div>
      )}
    </form>
  );
}
