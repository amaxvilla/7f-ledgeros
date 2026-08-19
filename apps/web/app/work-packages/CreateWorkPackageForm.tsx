'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createWorkPackage } from './actions';

/**
 * Frontend Completion, PMO.2 — flat header-fields form, NOT a dynamic
 * line array like `CreateBoqForm`/`CreateBudgetForm`. Confirmed
 * directly against `CreateWorkPackageDto` (`pmo.service.ts`): a plain
 * object with no nested array field at all — genuinely simpler than
 * Boq's own `lines`, closer in shape to `CreateAPInvoiceForm`'s header
 * fields alone.
 *
 * `projectId` is a real `Select`, reusing `CreateBoqForm`'s own
 * re-verified finding directly (`GET /dimensions/projects?entityId=`,
 * fetched in `page.tsx` and passed down the same way).
 *
 * `contractorId` is a required `TextField` here — NOT optional like
 * Boq's own version — see `actions.ts`'s own doc comment for the
 * `schema.prisma` confirmation. Still no registry to build a `Select`
 * from, so a required plain `TextField` is the correct shape, not an
 * upgrade withheld — there's nothing to pick from either way.
 *
 * `phaseId` is deliberately NOT a field on this form, same as
 * `CreateBoqForm` — no `GET /dimensions/phases` list endpoint exists.
 */
export function CreateWorkPackageForm({ entityId, projectOptions, initialProjectId }: { entityId: string; projectOptions: SelectOption[]; initialProjectId?: string }) {
  const [projectId, setProjectId] = React.useState(initialProjectId ?? '');
  const [contractorId, setContractorId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [budgetAmount, setBudgetAmount] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createWorkPackage({
      projectId,
      contractorId,
      code,
      name,
      description: description || undefined,
      budgetAmount: Number(budgetAmount),
    });

    setPending(false);
    if (result.ok) {
      setProjectId('');
      setContractorId('');
      setCode('');
      setName('');
      setDescription('');
      setBudgetAmount('');
    } else {
      setError(result.error ?? 'Failed to create work package.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Project"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        options={projectOptions}
        placeholder="Select a project…"
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ minWidth: '140px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField
        label="Contractor ID"
        value={contractorId}
        onChange={(e) => setContractorId(e.target.value)}
        required
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Budget amount"
        type="number"
        value={budgetAmount}
        onChange={(e) => setBudgetAmount(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating...' : 'Create work package'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
