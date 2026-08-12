'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createTask } from './actions';

/**
 * Frontend Completion, FE-5.1 — `parentTaskId` (optional) is a real
 * `Select` sourced from `taskOptions`, built by `page.tsx` from the
 * SAME task list its own table renders — no separate fetch, the same
 * "reuse what's already in hand" shape `RecordAcquisitionForm`'s own
 * `parcelOptions` uses. `isMilestone` is left off this form: it's an
 * optional boolean on the DTO with no checkbox primitive in `@7f/ui`
 * yet — the same restraint `CreateAccountForm`'s own doc comment gives
 * for `isControlAccount`/`isPostable`.
 */
export function CreateTaskForm({ entityId, projectId, taskOptions }: { entityId: string; projectId: string; taskOptions: SelectOption[] }) {
  const [parentTaskId, setParentTaskId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [plannedStart, setPlannedStart] = React.useState('');
  const [plannedEnd, setPlannedEnd] = React.useState('');
  const [budgetedCost, setBudgetedCost] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createTask({
      entityId,
      projectId,
      parentTaskId: parentTaskId || undefined,
      code: code || undefined,
      name,
      plannedStart,
      plannedEnd,
      budgetedCost: budgetedCost ? Number(budgetedCost) : undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create task.');
      return;
    }
    setParentTaskId('');
    setCode('');
    setName('');
    setPlannedStart('');
    setPlannedEnd('');
    setBudgetedCost('');
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
      <TextField label="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} style={{ minWidth: '120px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
      <Select
        label="Parent task (optional)"
        value={parentTaskId}
        onChange={(e) => setParentTaskId(e.target.value)}
        options={taskOptions}
        placeholder="No parent…"
        style={{ minWidth: '220px' }}
      />
      <TextField label="Planned start" type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="Planned end" type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField
        label="Budgeted cost (optional)"
        type="number"
        value={budgetedCost}
        onChange={(e) => setBudgetedCost(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add task'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
