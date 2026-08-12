'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import type { ProjectOption } from '../ProjectSelector';
import type { AgentOption } from './AgentSelector';
import { createAssignment } from './actions';

const SCOPE_OPTIONS: SelectOption[] = [
  { value: 'PROJECT', label: 'Project' },
  { value: 'UNIT', label: 'Unit' },
  { value: 'SALE', label: 'Sale (allocation)' },
];

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'CO_AGENT', label: 'Co-agent' },
  { value: 'REFERRAL', label: 'Referral' },
];

/**
 * `agentId`/`role`/`scope` are real `Select`s. The target field
 * switches on `scope`: a `Select` built from `projectOptions` (the same
 * entity-scoped `GET /dimensions/projects` list `TargetLookupForm`
 * already uses) for PROJECT, plain `TextField`s for UNIT/SALE — same
 * "no registry for units/allocations" gap `TargetLookupForm`'s own doc
 * comment names, not duplicated here in different words.
 *
 * `entityId` is NOT a field on this form — it's the page's own
 * currently-selected entity, passed in and sent as-is (see
 * `actions.ts`'s own doc comment for why the backend, not this form,
 * is the source of truth on whether that matches the target).
 */
export function CreateAssignmentForm({
  entityId,
  agentOptions,
  projectOptions,
}: {
  entityId: string;
  agentOptions: AgentOption[];
  projectOptions: ProjectOption[];
}) {
  const [agentId, setAgentId] = React.useState('');
  const [scope, setScope] = React.useState<'PROJECT' | 'UNIT' | 'SALE'>('PROJECT');
  const [role, setRole] = React.useState<'PRIMARY' | 'CO_AGENT' | 'REFERRAL'>('PRIMARY');
  const [projectId, setProjectId] = React.useState('');
  const [unitId, setUnitId] = React.useState('');
  const [allocationId, setAllocationId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const agentSelectOptions: SelectOption[] = agentOptions.map((a) => ({ value: a.id, label: `${a.code} — ${a.displayName}` }));
  const projectSelectOptions: SelectOption[] = projectOptions.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!agentId) {
      setError('Select an agent.');
      return;
    }
    if (scope === 'PROJECT' && !projectId) {
      setError('Select a project.');
      return;
    }
    if (scope === 'UNIT' && !unitId) {
      setError('Enter a unit ID.');
      return;
    }
    if (scope === 'SALE' && !allocationId) {
      setError('Enter a sale (allocation) ID.');
      return;
    }

    setPending(true);
    const result = await createAssignment({
      agentId,
      entityId,
      scope,
      role,
      projectId: scope === 'PROJECT' ? projectId : undefined,
      unitId: scope === 'UNIT' ? unitId : undefined,
      allocationId: scope === 'SALE' ? allocationId : undefined,
      notes: notes || undefined,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to create agent assignment.');
      return;
    }
    setSuccess('Assignment recorded.');
    setAgentId('');
    setProjectId('');
    setUnitId('');
    setAllocationId('');
    setNotes('');
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
      <Select label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} options={agentSelectOptions} placeholder="Select an agent" style={{ minWidth: '240px' }} />
      <Select label="Target type" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} options={SCOPE_OPTIONS} style={{ minWidth: '160px' }} />

      {scope === 'PROJECT' && (
        <Select label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projectSelectOptions} placeholder="Select a project" style={{ minWidth: '240px' }} />
      )}
      {scope === 'UNIT' && (
        <TextField label="Unit ID" value={unitId} onChange={(e) => setUnitId(e.target.value)} placeholder="e.g. 3fae0c9e-..." style={{ minWidth: '260px' }} />
      )}
      {scope === 'SALE' && (
        <TextField label="Sale (allocation) ID" value={allocationId} onChange={(e) => setAllocationId(e.target.value)} placeholder="e.g. 3fae0c9e-..." style={{ minWidth: '260px' }} />
      )}

      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as typeof role)} options={ROLE_OPTIONS} style={{ minWidth: '160px' }} />
      <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minWidth: '220px' }} />

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Create assignment'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {success && !error && <div style={{ width: '100%', color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>{success}</div>}
    </form>
  );
}
