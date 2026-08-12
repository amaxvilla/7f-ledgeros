'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createRequisition } from './actions';

interface Line {
  description: string;
  accountId: string;
  quantity: string;
  estimatedUnitCost: string;
}

const EMPTY_LINE: Line = { description: '', accountId: '', quantity: '1', estimatedUnitCost: '0' };

/**
 * Frontend Completion, FE-3.3 — reuses `CreateJournalEntryForm`'s own
 * dynamic add/remove-line pattern directly. `CreateRequisitionDto.lines`
 * requires `@ArrayMinSize(1)` (confirmed directly), so this form starts
 * with a single line and disables "Remove" once only one remains — the
 * same threshold `CreateBoqForm`'s own single-starting-line shape uses,
 * unlike `CreateJournalEntryForm`'s two-line minimum for a balanced
 * entry.
 *
 * `accountId` per line is a real `Select` sourced from `accountOptions`
 * fetched by `page.tsx` (`GET /accounts`) — every requisition line
 * posts against a GL account (`CreateRequisitionLineDto.accountId`,
 * confirmed directly), the same "fetch in the Server Component, pass
 * the array down" shape `CreateJournalEntryForm`'s own `accountOptions`
 * prop uses. `projectId` (header-level, optional) is likewise a real
 * `Select` sourced from `projectOptions` — `Dimensions`' own Projects
 * registry (`GET /dimensions/projects?entityId=`) now exists as of
 * FE-3.2, unlike `CreateBoqForm`'s own `projectId` which predates it
 * and is still a plain `TextField`; this form uses the registry now
 * that it's there.
 *
 * `budgetLineId` per line is deliberately left OFF this form even
 * though `CreateRequisitionLineDto` has an optional `budgetLineId`
 * field: it's an id into `BudgetLine`, a resource with no registry page
 * or list-by-project endpoint confirmed yet in this checkpoint's own
 * scope — same "no registry to build a Select from, don't add a bare
 * id TextField either" restraint `CreateAccountForm`'s own doc comment
 * gives for `isControlAccount`/`isPostable`, just applied to a missing
 * picker instead of a missing primitive. `departmentId`/`costCenterId`/
 * `fundingSourceId` are left off for the same reason `CreateBudgetForm`
 * already gives for its own equivalent fields.
 *
 * ADDENDUM (FE-10.25, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add line),
 * same fix `CreateBudgetForm`/`ReviseBudgetForm`/`CreateJournalEntryForm`
 * each got in this rollout's previous batch. Verified directly against
 * this file's own current source before fixing, not against a
 * remembered file count.
 */
export function CreateRequisitionForm({ entityId, accountOptions, projectOptions }: { entityId: string; accountOptions: SelectOption[]; projectOptions: SelectOption[] }) {
  const [prNumber, setPrNumber] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [justification, setJustification] = React.useState('');
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

    const result = await createRequisition({
      entityId,
      prNumber,
      projectId: projectId || undefined,
      justification: justification || undefined,
      lines: lines.map((line) => ({
        description: line.description,
        accountId: line.accountId,
        quantity: Number(line.quantity),
        estimatedUnitCost: Number(line.estimatedUnitCost),
      })),
    });

    setPending(false);
    if (result.ok) {
      setPrNumber('');
      setProjectId('');
      setJustification('');
      setLines([{ ...EMPTY_LINE }]);
    } else {
      setError(result.error ?? 'Failed to create requisition.');
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
        <TextField label="PR number" value={prNumber} onChange={(e) => setPrNumber(e.target.value)} required style={{ minWidth: '160px' }} />
        <Select
          label="Project (optional)"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={projectOptions}
          placeholder="No project…"
          style={{ minWidth: '220px' }}
        />
        <TextField
          label="Justification (optional)"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          style={{ minWidth: '260px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Lines</span>
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Description (line ${index + 1})`}
              value={line.description}
              onChange={(e) => updateLine(index, 'description', e.target.value)}
              required
              style={{ minWidth: '220px' }}
            />
            <Select
              label={`Account (line ${index + 1})`}
              value={line.accountId}
              onChange={(e) => updateLine(index, 'accountId', e.target.value)}
              options={accountOptions}
              placeholder="Select an account…"
              required
              style={{ minWidth: '220px' }}
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
              label={`Est. unit cost (line ${index + 1})`}
              type="number"
              value={line.estimatedUnitCost}
              onChange={(e) => updateLine(index, 'estimatedUnitCost', e.target.value)}
              required
              style={{ minWidth: '140px' }}
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
          {pending ? 'Creating…' : 'Create requisition'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
