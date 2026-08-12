'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createRequisition } from './actions';

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'CONSULTANT', label: 'Consultant' },
];

/**
 * Frontend Completion, Checkpoint AG — ninth data-entry form, following
 * `CreateVacancyForm`'s own pattern exactly (manual pending/error
 * useState, 'use client' form + 'use server' action split,
 * reset-on-success). The first form on this page to precede the table
 * whose rows it creates, the same "form sits above its own DataTable"
 * layout `CreateVacancyForm` already established for vacancies — placed
 * above the "Job requisitions" section in `page.tsx`, that table's own
 * previous checkpoint (AF) having had nothing above it to fill it.
 *
 * Every optional field on `CreateRequisitionDto` gets its own field
 * here — `departmentId`/`costCenterId`/`projectId`/`budgetLineId` all
 * stay plain TextFields (ids from other registries — Department,
 * CostCenter, Project, BudgetLine — not fixed enums), the same "id
 * field, not an enum" reasoning `CreateLeaseForm`'s own
 * `tenantId`/`unitId` doc comment gives; a fetched-dropdown upgrade for
 * any of them is a reasonable future checkpoint; this one isn't built to
 * guess which of the four is worth that first.
 *
 * `headcount` is the only numeric field (`CreateRequisitionDto.headcount?`,
 * defaults to 1 server-side) — converted with the same
 * `value ? Number(value) : undefined` shape `CreateLeaseForm`'s own
 * `depositAmount` already uses, so an intentional 0 is indistinguishable
 * from blank here; that's the same tradeoff `depositAmount` already
 * accepted, not a new one introduced by this form.
 *
 * `employmentType` reuses the exact same `EMPLOYMENT_TYPE_OPTIONS`
 * array `CreateVacancyForm` already defines — duplicated here rather
 * than imported, since neither form imports from the other and the enum
 * is small and copied inline the same way across every other form in
 * this app that touches a Prisma enum (no shared "enum options" module
 * exists yet, and inventing one for a five-item array shared by exactly
 * two forms isn't this checkpoint's job).
 */
export function CreateRequisitionForm({ entityId }: { entityId: string }) {
  const [jobTitle, setJobTitle] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [costCenterId, setCostCenterId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [employmentType, setEmploymentType] = React.useState('');
  const [headcount, setHeadcount] = React.useState('');
  const [justification, setJustification] = React.useState('');
  const [budgetLineId, setBudgetLineId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createRequisition({
      entityId,
      jobTitle,
      departmentId: departmentId || undefined,
      costCenterId: costCenterId || undefined,
      projectId: projectId || undefined,
      gradeLevel: gradeLevel || undefined,
      employmentType: employmentType || undefined,
      headcount: headcount ? Number(headcount) : undefined,
      justification: justification || undefined,
      budgetLineId: budgetLineId || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create requisition.');
      return;
    }
    setJobTitle('');
    setDepartmentId('');
    setCostCenterId('');
    setProjectId('');
    setGradeLevel('');
    setEmploymentType('');
    setHeadcount('');
    setJustification('');
    setBudgetLineId('');
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
      aria-label={`Add requisition for entity ${entityId}`}
    >
      <TextField label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField
        label="Department ID (optional)"
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Cost center ID (optional)"
        value={costCenterId}
        onChange={(e) => setCostCenterId(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Project ID (optional)"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Grade level (optional)"
        value={gradeLevel}
        onChange={(e) => setGradeLevel(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Employment type"
        value={employmentType}
        onChange={(e) => setEmploymentType(e.target.value)}
        options={EMPLOYMENT_TYPE_OPTIONS}
        placeholder="Default (full-time)"
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Headcount (optional)"
        type="number"
        min={1}
        value={headcount}
        onChange={(e) => setHeadcount(e.target.value)}
        style={{ minWidth: '120px' }}
      />
      <TextField
        label="Budget line ID (optional)"
        value={budgetLineId}
        onChange={(e) => setBudgetLineId(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Justification (optional)"
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add requisition'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
