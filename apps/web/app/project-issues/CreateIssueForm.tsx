'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createIssue } from './actions';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

/**
 * Frontend Completion — `projectId` is now a `Select` fed by the
 * caller-supplied `projectOptions` prop, same correction and same
 * `CreateBudgetForm`-style "fetch in the Server Component, pass the
 * array down" pattern `CreateRiskForm`'s own doc comment describes in
 * full (the outdated "no Projects registry exists" claim this form
 * previously carried was wrong — corrected during FE-2.5). `assignedToId`
 * stays a plain optional `TextField` — a user id, unrelated to the
 * Projects registry correction; this app still has no user-picker
 * anywhere.
 *
 * `priority` defaults to MEDIUM server-side (`ProjectIssue.priority`'s
 * own Prisma `@default(MEDIUM)`, confirmed directly) if left on this
 * form's placeholder — same "start on the placeholder, submit
 * `undefined`, let the backend's own default apply" posture
 * `CreateRiskForm`'s own `probability`/`impact` fields already take,
 * just with a fourth option (`CRITICAL`) since `IssuePriority` has one
 * more member than `RiskProbability`/`RiskImpact`.
 *
 * `dueDate` is a native `type="date"` `TextField` — `CreateIssueDto`
 * takes an ISO date string (`@IsDateString`), which is exactly what a
 * date input's own `value`/`onChange` already produce, so no separate
 * formatting step is needed before it's sent.
 */
export function CreateIssueForm({ entityId, projectOptions }: { entityId: string; projectOptions: SelectOption[] }) {
  const [projectId, setProjectId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState('');
  const [assignedToId, setAssignedToId] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createIssue({
      entityId,
      projectId,
      title,
      description: description || undefined,
      priority: priority || undefined,
      assignedToId: assignedToId || undefined,
      dueDate: dueDate || undefined,
    });

    setPending(false);
    if (result.ok) {
      setProjectId('');
      setTitle('');
      setDescription('');
      setPriority('');
      setAssignedToId('');
      setDueDate('');
    } else {
      setError(result.error ?? 'Failed to create issue.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <Select
        label="Project"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        options={projectOptions}
        placeholder="Select a project…"
        required
        style={{ minWidth: '200px' }}
      />
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ minWidth: '200px' }} />
      <Select
        label="Priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        options={PRIORITY_OPTIONS}
        placeholder="Default (Medium)"
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Assigned to (optional)"
        value={assignedToId}
        onChange={(e) => setAssignedToId(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Due date (optional)"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Logging…' : 'Log issue'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
