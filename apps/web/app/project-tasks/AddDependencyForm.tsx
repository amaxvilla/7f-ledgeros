'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { addDependency } from './actions';

const TYPE_OPTIONS = [
  { value: 'FINISH_TO_START', label: 'Finish to start' },
  { value: 'START_TO_START', label: 'Start to start' },
  { value: 'FINISH_TO_FINISH', label: 'Finish to finish' },
  { value: 'START_TO_FINISH', label: 'Start to finish' },
];

/**
 * Frontend Completion, FE-5.2 — `predecessorId`/`successorId` both
 * reuse the SAME `taskOptions` prop `CreateTaskForm`'s own
 * `parentTaskId` field uses (see `page.tsx`'s own doc comment). `type`
 * defaults to `FINISH_TO_START` server-side if omitted
 * (`schema.prisma`'s own default on `TaskDependency.type`, confirmed
 * directly) but is still offered as a real choice here rather than
 * hidden, since the other three types are genuinely meaningful
 * scheduling relationships, not edge cases to bury. `lagDays` is
 * optional and can be negative (lead time) — plain number `TextField`,
 * no `min` attribute, unlike every other numeric field on this page's
 * sibling forms.
 */
export function AddDependencyForm({ taskOptions }: { taskOptions: SelectOption[] }) {
  const [predecessorId, setPredecessorId] = React.useState('');
  const [successorId, setSuccessorId] = React.useState('');
  const [type, setType] = React.useState('');
  const [lagDays, setLagDays] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await addDependency({
      predecessorId,
      successorId,
      type: type || undefined,
      lagDays: lagDays ? Number(lagDays) : undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to add dependency.');
      return;
    }
    setPredecessorId('');
    setSuccessorId('');
    setType('');
    setLagDays('');
    setSuccess(true);
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
        label="Predecessor task"
        value={predecessorId}
        onChange={(e) => setPredecessorId(e.target.value)}
        options={taskOptions}
        placeholder="Select a task…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Successor task"
        value={successorId}
        onChange={(e) => setSuccessorId(e.target.value)}
        options={taskOptions}
        placeholder="Select a task…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Type (optional)"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={TYPE_OPTIONS}
        placeholder="Finish to start (default)"
        style={{ minWidth: '180px' }}
      />
      <TextField label="Lag days (optional)" type="number" value={lagDays} onChange={(e) => setLagDays(e.target.value)} style={{ minWidth: '120px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add dependency'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {success && (
        <div style={{ width: '100%', color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Dependency added.
        </div>
      )}
    </form>
  );
}
