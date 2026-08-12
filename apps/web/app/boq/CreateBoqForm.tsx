'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createBoq } from './actions';

interface Line {
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
}

const EMPTY_LINE: Line = { itemCode: '', description: '', unit: '', quantity: '', rate: '' };

/**
 * Frontend Completion, PMO.1 — this module's first create form, reusing
 * `CreateBudgetForm`'s own dynamic add/remove-line pattern directly for
 * `lines` (`PmoService.createBoq` throws `BadRequestException` on an
 * empty array, confirmed directly — the same "at least one line" rule
 * `CreateBudgetDto` enforces, just via a manual check rather than
 * `@ArrayMinSize`).
 *
 * `projectId` IS A REAL `Select` HERE, NOT A PLAIN `TextField` —
 * a genuine, re-verified correction, not an assumption carried over.
 * `project-risks/page.tsx`'s own doc comment states "NO PROJECTS
 * REGISTRY EXISTS ANYWHERE IN THIS BACKEND," but a direct re-check this
 * checkpoint (following AP.2/AR.2's own "worth re-verifying directly
 * before assuming any prior report" recommendation) found
 * `GET /dimensions/projects` (`DimensionsController.findProjects`,
 * optional `entityId` filter) DOES exist and returns exactly the
 * `Project` rows `Boq.projectId`/`WorkPackage.projectId` reference
 * (confirmed against `schema.prisma`'s own `Boq.project` relation —
 * the SAME `Project` model `GET /dimensions/projects` lists, not a
 * different PMO-specific one). That registry simply post-dates
 * `project-risks`'/`project-issues`' own checkpoints, which is why
 * their own `projectId` fields are still plain `TextField`s — left
 * exactly as-is here, since fixing them is a separate, unscoped
 * checkpoint (see this checkpoint's own release report). `page.tsx`
 * fetches `GET /dimensions/projects?entityId=` (this page's own
 * `entityId` already in scope) and passes the result down as
 * `projectOptions`, the same "fetch in the Server Component, pass the
 * array down" shape `accountOptions` already established for
 * `CreateBudgetForm`.
 *
 * `contractorId` stays a plain optional `TextField` — confirmed
 * directly (grepped every `*.controller.ts`/`*.service.ts` for a
 * `contractor` route) that no `Contractor` registry endpoint exists
 * anywhere in this backend, unlike `projectId` above. Same "id from
 * another registry with nothing to pick it from" reasoning
 * `CreateRiskForm`'s own `ownerId`/`project-risks`' own `projectId` doc
 * comments already give.
 *
 * `phaseId` is deliberately NOT a field on this form at all (not even a
 * `TextField`) — see `actions.ts`'s own doc comment for why: no
 * `GET /dimensions/phases` list endpoint exists to build even an opaque
 * picker from, and guessing a raw phase id with nothing to validate it
 * against client-side isn't worth the field for an optional value.
 *
 * ADDENDUM (FE-10.32, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add line),
 * same fix `ImportStatementForm`'s own sibling ADDENDUM in this same
 * batch just applied. Verified directly against this file's own
 * current source before fixing.
 */
export function CreateBoqForm({ entityId, projectOptions }: { entityId: string; projectOptions: SelectOption[] }) {
  const [projectId, setProjectId] = React.useState('');
  const [contractorId, setContractorId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [lines, setLines] = React.useState<Line[]>([{ ...EMPTY_LINE }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createBoq({
      projectId,
      contractorId: contractorId || undefined,
      title,
      lines: lines.map((line) => ({
        itemCode: line.itemCode,
        description: line.description,
        unit: line.unit,
        quantity: Number(line.quantity),
        rate: Number(line.rate),
      })),
    });

    setPending(false);
    if (result.ok) {
      setProjectId('');
      setContractorId('');
      setTitle('');
      setLines([{ ...EMPTY_LINE }]);
    } else {
      setError(result.error ?? 'Failed to create BOQ.');
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
        <Select
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={projectOptions}
          placeholder="Select a project…"
          required
          style={{ minWidth: '220px' }}
        />
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ minWidth: '220px' }} />
        <TextField
          label="Contractor ID (optional)"
          value={contractorId}
          onChange={(e) => setContractorId(e.target.value)}
          style={{ minWidth: '200px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>BOQ lines</span>
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Item code (line ${index + 1})`}
              value={line.itemCode}
              onChange={(e) => updateLine(index, 'itemCode', e.target.value)}
              required
              style={{ minWidth: '140px' }}
            />
            <TextField
              label={`Description (line ${index + 1})`}
              value={line.description}
              onChange={(e) => updateLine(index, 'description', e.target.value)}
              required
              style={{ minWidth: '220px' }}
            />
            <TextField
              label={`Unit (line ${index + 1})`}
              value={line.unit}
              onChange={(e) => updateLine(index, 'unit', e.target.value)}
              required
              style={{ minWidth: '100px' }}
            />
            <TextField
              label={`Quantity (line ${index + 1})`}
              type="number"
              value={line.quantity}
              onChange={(e) => updateLine(index, 'quantity', e.target.value)}
              required
              style={{ minWidth: '120px' }}
            />
            <TextField
              label={`Rate (line ${index + 1})`}
              type="number"
              value={line.rate}
              onChange={(e) => updateLine(index, 'rate', e.target.value)}
              required
              style={{ minWidth: '120px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addLine}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add line
        </Button>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create BOQ'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
