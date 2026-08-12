'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createCorrectiveAction } from './actions';

/**
 * Frontend Completion, HSE.2 — see `actions.ts`'s own doc comment for
 * why "Linked to" is ONE combined `Select` (prefixed `incident:<id>` /
 * `nearmiss:<id>` values) rather than two separate incident/near-miss
 * pickers, and why `assignedToId` stays a plain optional `TextField`.
 */
export function CreateCorrectiveActionForm({ linkOptions }: { linkOptions: SelectOption[] }) {
  const [linkedTo, setLinkedTo] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [assignedToId, setAssignedToId] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const isIncident = linkedTo.startsWith('incident:');
    const isNearMiss = linkedTo.startsWith('nearmiss:');
    const linkedId = isIncident ? linkedTo.slice('incident:'.length) : isNearMiss ? linkedTo.slice('nearmiss:'.length) : '';

    const result = await createCorrectiveAction({
      incidentReportId: isIncident ? linkedId : undefined,
      nearMissId: isNearMiss ? linkedId : undefined,
      description,
      assignedToId: assignedToId || undefined,
      dueDate,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create corrective action.');
      return;
    }
    setLinkedTo('');
    setDescription('');
    setAssignedToId('');
    setDueDate('');
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
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Linked to"
        value={linkedTo}
        onChange={(e) => setLinkedTo(e.target.value)}
        options={linkOptions}
        placeholder="Select an incident or near miss…"
        required
        style={{ minWidth: '260px' }}
      />
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} required style={{ minWidth: '260px' }} />
      <TextField
        label="Assigned to (optional)"
        value={assignedToId}
        onChange={(e) => setAssignedToId(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required style={{ minWidth: '160px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Logging…' : 'Log corrective action'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
