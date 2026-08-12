'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createBudget } from './actions';

const MONTH_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

interface Line {
  accountId: string;
  period: string;
  amount: string;
}

const EMPTY_LINE: Line = { accountId: '', period: '', amount: '' };

/**
 * Frontend Completion, Budgeting (BUD.2) — this app's first dynamic
 * add/remove-line form. Every prior `Create*Form` (through Project
 * Issues) has been a flat object with one input per DTO field; `lines`
 * (`CreateBudgetDto`, `@ArrayMinSize(1)`) is this app's first field
 * that's itself an array the user needs to build up interactively.
 * Kept as a plain `Line[]` in local state (add/remove via index-based
 * `setLines`), not a form library or a generic `<FieldArray>`
 * component in `@7f/ui` — Select's own doc comment gives the reasoning
 * this checkpoint follows: build "the simplest correct version," let a
 * second real consumer (Revise/Transfer will likely want the same
 * add/remove-row shape for their own line-amount arrays) justify
 * extracting a shared abstraction, rather than guessing at its shape
 * from a single caller now.
 *
 * Only three of `CreateBudgetLineDto`'s eight fields are exposed per
 * line: `accountId` (required), `period` (required), `amount`
 * (required). The five optional dimension ids (`projectId`, `phaseId`,
 * `departmentId`, `costCenterId`, `fundingSourceId`) are deliberately
 * NOT fields on this form — adding all eight to every dynamically-added
 * row would roughly double this checkpoint's own size for a set of
 * fields nothing else in this app has surfaced a picker for yet (same
 * "no registry to build a Select from" position `projectId` is already
 * in on Project Risks/Issues). Left for a future checkpoint if budget
 * lines ever need dimension-level detail entered through this form,
 * rather than guessed at here.
 *
 * `accountId` IS a real `Select`, not a plain `TextField` like
 * Risks/Issues' own `projectId` — unlike `projectId`, a real registry
 * exists (`GET /accounts/entity/:entityId/active`,
 * `ChartOfAccountsController`, confirmed directly) and `page.tsx`
 * already has this page's own `entityId` in scope to fetch it with. Per
 * Select's own doc comment ("a future checkpoint wiring a dynamic
 * option set... fetches in its own Server Component and passes the
 * resulting array down"), `page.tsx` fetches the account list and
 * passes `accountOptions` down as a prop — this component itself has no
 * data-fetching concern of its own, same as every other consumer of
 * `Select`.
 *
 * `period` is a `Select` of the 12 calendar months (`CreateBudgetLineDto.period`
 * is `@Min(1) @Max(12)`, confirmed directly) rather than a numeric
 * `TextField` — a bounded 1–12 range is exactly the kind of "small,
 * fixed set of values" Select's own doc comment names as its reason to
 * exist, the same choice `CreateRiskForm`'s `probability`/`impact` and
 * `CreateIssueForm`'s `priority` already made for their own bounded
 * enums.
 *
 * ADDENDUM (FE-10.24, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add line);
 * each now renders at `Button`'s own properly-sized default touch
 * target. Verified directly against this file's own current source
 * before fixing, not against a remembered file count from an earlier
 * checkpoint's own report — this rollout's own established discipline,
 * repeated in every sibling ADDENDUM so far.
 */
export function CreateBudgetForm({ entityId, accountOptions }: { entityId: string; accountOptions: SelectOption[] }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [fiscalYear, setFiscalYear] = React.useState('');
  const [description, setDescription] = React.useState('');
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

    const result = await createBudget({
      entityId,
      code,
      name,
      fiscalYear: Number(fiscalYear),
      description: description || undefined,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        period: Number(line.period),
        amount: Number(line.amount),
      })),
    });

    setPending(false);
    if (result.ok) {
      setCode('');
      setName('');
      setFiscalYear('');
      setDescription('');
      setLines([{ ...EMPTY_LINE }]);
    } else {
      setError(result.error ?? 'Failed to create budget.');
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
        <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ minWidth: '140px' }} />
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '200px' }} />
        <TextField
          label="Fiscal year"
          type="number"
          value={fiscalYear}
          onChange={(e) => setFiscalYear(e.target.value)}
          required
          style={{ minWidth: '120px' }}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ minWidth: '220px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Budget lines</span>
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <Select
              label={`Account (line ${index + 1})`}
              value={line.accountId}
              onChange={(e) => updateLine(index, 'accountId', e.target.value)}
              options={accountOptions}
              placeholder="Select an account…"
              required
              style={{ minWidth: '220px' }}
            />
            <Select
              label={`Period (line ${index + 1})`}
              value={line.period}
              onChange={(e) => updateLine(index, 'period', e.target.value)}
              options={MONTH_OPTIONS}
              placeholder="Select a month…"
              required
              style={{ minWidth: '160px' }}
            />
            <TextField
              label={`Amount (line ${index + 1})`}
              type="number"
              value={line.amount}
              onChange={(e) => updateLine(index, 'amount', e.target.value)}
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
          {pending ? 'Creating…' : 'Create budget'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
