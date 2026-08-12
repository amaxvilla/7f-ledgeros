'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createJournalEntry } from './actions';

interface Line {
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}

const EMPTY_LINE: Line = { accountId: '', debit: '0', credit: '0', memo: '' };

/**
 * Frontend Completion, FE-3.1 — reuses `CreateBoqForm`'s own dynamic
 * add/remove-line pattern directly for `lines`, the same way
 * `CreateBoqForm` itself reused `CreateBudgetForm`'s (see that
 * component's own doc comment). `CreateJournalEntryDto.lines` requires
 * `@ArrayMinSize(2)` — a journal entry needs at least two lines to
 * balance, confirmed directly against the DTO — so this form starts
 * with two empty lines rather than one, unlike `CreateBoqForm`'s single
 * starting line, and disables "Remove" once only two remain instead of
 * one.
 *
 * `accountId` is a real `Select`, sourced from `accountOptions` fetched
 * by `page.tsx` (`GET /accounts`) and passed down — the same
 * "fetch in the Server Component, pass the array down" shape
 * `CreateBoqForm`'s own `projectOptions` already established. Each
 * line's `debit`/`credit` are both plain number `TextField`s rather
 * than a single signed-amount field: `CreateJournalLineDto` genuinely
 * has both as separate required numeric fields (confirmed directly),
 * not a computed split — this form doesn't invent a friendlier
 * single-field UI that the DTO shape doesn't support.
 *
 * `entityId` is a prop (not a field on this form) — same as
 * `CreateBoqForm`'s own `entityId` prop, sourced from the page's
 * `EntitySelector`-driven `searchParams` rather than typed in twice.
 * `sourceType`/`sourceReference` are both left off entirely: both are
 * optional on the DTO and `sourceType` defaults to `MANUAL` server-side
 * (`schema.prisma`'s own `@default(MANUAL)`) — exactly the case a user
 * creating an entry through this UI is in, so there's nothing this form
 * needs to ask for. The seven optional per-line dimension ids
 * (`projectId`/`phaseId`/`blockId`/`floorId`/`unitId`/`departmentId`/
 * `costCenterId`/`fundingSourceId`/`vendorId`/`customerId`) are left off
 * for the same "no registry to build most of these Selects from, and a
 * plain TextField per line would triple this form's width" reasoning
 * `CreateBudgetForm`'s own doc comment gives for its five left-out
 * dimension ids.
 *
 * ADDENDUM (FE-10.24, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add line),
 * same fix as `CreateBudgetForm`/`ReviseBudgetForm`'s own sibling
 * ADDENDUMs in this same batch. Verified directly against this file's
 * own current source before fixing.
 */
export function CreateJournalEntryForm({ entityId, accountOptions }: { entityId: string; accountOptions: SelectOption[] }) {
  const [entryDate, setEntryDate] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [lines, setLines] = React.useState<Line[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
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

    const result = await createJournalEntry({
      entityId,
      entryDate,
      description,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        debit: Number(line.debit),
        credit: Number(line.credit),
        memo: line.memo || undefined,
      })),
    });

    setPending(false);
    if (result.ok) {
      setEntryDate('');
      setDescription('');
      setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
    } else {
      setError(result.error ?? 'Failed to create journal entry.');
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
        <TextField
          label="Entry date"
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          style={{ minWidth: '280px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Journal lines</span>
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
            <TextField
              label={`Debit (line ${index + 1})`}
              type="number"
              value={line.debit}
              onChange={(e) => updateLine(index, 'debit', e.target.value)}
              required
              style={{ minWidth: '120px' }}
            />
            <TextField
              label={`Credit (line ${index + 1})`}
              type="number"
              value={line.credit}
              onChange={(e) => updateLine(index, 'credit', e.target.value)}
              required
              style={{ minWidth: '120px' }}
            />
            <TextField
              label={`Memo (line ${index + 1}, optional)`}
              value={line.memo}
              onChange={(e) => updateLine(index, 'memo', e.target.value)}
              style={{ minWidth: '200px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeLine(index)}
              disabled={lines.length === 2}
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
          {pending ? 'Creating…' : 'Create journal entry'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
