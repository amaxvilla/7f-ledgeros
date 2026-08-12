'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createVacancy } from './actions';

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'CONSULTANT', label: 'Consultant' },
];

/**
 * Frontend Completion — eighth data-entry form, following
 * CreateIpRuleForm (Checkpoint Y) and every form since Checkpoint Q
 * (see any of their own doc comments for the shared conventions: manual
 * pending/error useState, 'use client' form + 'use server' action
 * split, reset-on-success). The first form added to a page that
 * predates the form-per-page convention — Recruitment (Checkpoint B)
 * was read-only until now.
 *
 * `employmentType` uses Select — EmploymentType is a real fixed
 * five-value Prisma enum (FULL_TIME/PART_TIME/CONTRACT/INTERN/
 * CONSULTANT), the same "real fixed enum, not free text" bar
 * CreateIpRuleForm's own scope field and CreateLeaseForm's
 * rentFrequency both cleared. Optional (CreateVacancyDto's own
 * `employmentType?`, falling back to the parent requisition's own type
 * server-side) — a placeholder option is shown and the field isn't
 * `required`, same posture CreateLeaseForm's rentFrequency takes.
 *
 * `jobRequisitionId` — Checkpoint AH: upgraded from a plain TextField to
 * a Select, per Checkpoint AG's own recommendation. `page.tsx` already
 * fetches the full requisitions list for its "Job requisitions" table;
 * this checkpoint filters that same array to `status === 'APPROVED'`
 * (the only status `RecruitmentService.createVacancy()` itself accepts
 * — see that method's own `ConflictException` otherwise) and passes it
 * down as `requisitions`, rather than this component fetching anything
 * itself — Select's own doc comment is explicit that options are
 * caller-supplied, and that split holds here too: the Server Component
 * fetches, this Client Component only renders.
 *
 * CORRECTION (FE-10.8) — the paragraph below, as originally written at
 * Checkpoint AH, predates Select's own empty-options redesign
 * (FE-10.2) and described a behavior Select no longer has: if the
 * filtered list is empty, Select does NOT keep rendering an
 * interactive `<select>` with only a placeholder option — it replaces
 * the control entirely with a plain, non-interactive `<div>` carrying
 * an `emptyMessage` (this form's own `placeholder` text, "No approved
 * requisitions available", is passed as the `placeholder` prop, but
 * that prop is only ever used inside the `<select>` branch; Select's
 * own default `emptyMessage` — "No options available." — is what
 * actually renders here, since this form passes no `emptyMessage` of
 * its own). This mismatch between the doc comment's own claim and
 * Select's real behavior had been silently making this test's own
 * empty-state assertions fail; both are corrected as of FE-10.8.
 *
 * Takes `entityId` as a prop, same as CreateLeaseForm — this page
 * already threads entityId through EntitySelector; unlike
 * createVacancy() itself (which takes no entityId — it derives one from
 * the referenced requisition server-side, see RecruitmentService.createVacancy),
 * this component still needs the prop so its parent (RecruitmentPage)
 * has something concrete to key the surrounding page's own re-render on
 * after revalidatePath('/recruitment') runs; the value itself is not
 * sent in the request body.
 */
export function CreateVacancyForm({
  entityId,
  requisitions,
}: {
  entityId: string;
  /** Pre-filtered by the caller to APPROVED requisitions only — see doc comment above. */
  requisitions: { id: string; jobTitle: string }[];
}) {
  const [jobRequisitionId, setJobRequisitionId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [employmentType, setEmploymentType] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createVacancy({
      jobRequisitionId,
      title,
      description: description || undefined,
      location: location || undefined,
      employmentType: employmentType || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create vacancy.');
      return;
    }
    setJobRequisitionId('');
    setTitle('');
    setDescription('');
    setLocation('');
    setEmploymentType('');
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
      aria-label={`Add vacancy for entity ${entityId}`}
    >
      <Select
        label="Job requisition"
        value={jobRequisitionId}
        onChange={(e) => setJobRequisitionId(e.target.value)}
        options={requisitions.map((r) => ({ value: r.id, label: r.jobTitle }))}
        placeholder={requisitions.length === 0 ? 'No approved requisitions available' : 'Select a requisition…'}
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField
        label="Location (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <Select
        label="Employment type"
        value={employmentType}
        onChange={(e) => setEmploymentType(e.target.value)}
        options={EMPLOYMENT_TYPE_OPTIONS}
        placeholder="Default (requisition's type)"
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add vacancy'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
