'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { startWorkflowInstance } from './actions';

const TRI_STATE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

/**
 * Frontend Completion, FE-8.9. See `./actions.ts`'s own doc comment for
 * the full before-coding analysis (which two `entityId` fields exist
 * and why, why no redirect-after-success, why `budgetAvailable` is
 * rendered as a tri-state `Select` rather than a raw checkbox — this
 * app has no shared Checkbox primitive at all, confirmed against
 * `packages/ui/src/index.ts`'s own export list, and a tri-state Select
 * represents "not specified" more honestly than an unchecked checkbox
 * would for a genuinely optional boolean rule-context field).
 *
 * `workflowCode`/`entityType` come in as fixed props from the parent
 * definition-detail page, not form fields — rendered read-only inline
 * rather than disabled `TextField`s, since they're not really "form
 * fields the user could change" at all.
 *
 * ADDENDUM (Mobile Responsiveness, page-level layout audit) — the
 * `workflowCode`/`entityType` row gained `flexWrap: 'wrap'`, same
 * reasoning as `StockBalanceLookup.tsx`'s own addendum: a labeled-stat
 * flex row with a fixed gap and no wrap, one of only two genuine
 * findings the page-level audit turned up (everything else — grids,
 * tables, `PageContainer`'s own padding, submit-button rows — was
 * already responsive or safe on inspection). No test added, same
 * behavior-not-style test-file distinction that file's own addendum
 * explains.
 */
export function StartInstanceForm({ workflowCode, entityType }: { workflowCode: string; entityType: string }) {
  const [entityId, setEntityId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [contextEntityId, setContextEntityId] = React.useState('');
  const [role, setRole] = React.useState('');
  const [riskLevel, setRiskLevel] = React.useState('');
  const [budgetAvailable, setBudgetAvailable] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [instanceId, setInstanceId] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setInstanceId(null);

    const result = await startWorkflowInstance({
      workflowCode,
      entityType,
      entityId,
      context: {
        amount: amount ? Number(amount) : undefined,
        departmentId: departmentId || undefined,
        projectId: projectId || undefined,
        entityId: contextEntityId || undefined,
        role: role || undefined,
        riskLevel: riskLevel || undefined,
        budgetAvailable: budgetAvailable === '' ? undefined : budgetAvailable === 'true',
      },
    });

    setPending(false);
    if (result.ok) {
      setInstanceId(result.instanceId ?? null);
      setEntityId('');
      setAmount('');
      setDepartmentId('');
      setProjectId('');
      setContextEntityId('');
      setRole('');
      setRiskLevel('');
      setBudgetAvailable('');
    } else {
      setError(result.error ?? 'Failed to start workflow instance.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(4),
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(4), fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
        <span>
          Workflow: <strong>{workflowCode}</strong>
        </span>
        <span>
          Entity type: <strong>{entityType}</strong>
        </span>
      </div>

      <TextField
        label="Record ID"
        value={entityId}
        onChange={(e) => setEntityId(e.target.value)}
        required
        style={{ minWidth: '260px' }}
      />

      <div>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          Context (all optional — used to evaluate this workflow&apos;s own rules)
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), marginTop: tokens.space(2) }}>
          <TextField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ minWidth: '140px' }} />
          <TextField label="Department ID" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ minWidth: '160px' }} />
          <TextField label="Project ID" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ minWidth: '160px' }} />
          <TextField
            label="Context: entity ID"
            value={contextEntityId}
            onChange={(e) => setContextEntityId(e.target.value)}
            style={{ minWidth: '160px' }}
          />
          <TextField label="Role" value={role} onChange={(e) => setRole(e.target.value)} style={{ minWidth: '140px' }} />
          <TextField label="Risk level" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} style={{ minWidth: '140px' }} />
          <Select
            label="Budget available"
            value={budgetAvailable}
            onChange={(e) => setBudgetAvailable(e.target.value)}
            options={TRI_STATE_OPTIONS}
            style={{ minWidth: '160px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Starting…' : 'Start instance'}
        </Button>
        {instanceId && (
          <Link href={`/workflow/instances/${instanceId}`} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            View instance →
          </Link>
        )}
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
