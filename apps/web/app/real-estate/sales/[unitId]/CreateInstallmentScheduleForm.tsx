'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createInstallmentSchedule } from './actions';

interface InstallmentRow {
  dueDate: string;
  amountDue: string;
}

const EMPTY_ROW: InstallmentRow = { dueDate: '', amountDue: '' };

/**
 * Frontend Completion, FE-4.12 — Create Installment Schedule, one half
 * of the pair FE-4.11's own report named as the next Real Estate work.
 * `CreateInstallmentPlanDto`'s own `installments` field is a
 * non-empty array of `{ dueDate, amountDue }` pairs — reuses
 * `CreateBoqForm.tsx`'s own dynamic add/remove-row pattern directly,
 * the same "at least one row" shape (`RealEstateService.createInstallmentSchedule`
 * doesn't explicitly reject an empty array with its own message the way
 * `PmoService.createBoq` does, but summing zero installments against a
 * real `salePrice` would always fail the total-must-match check below,
 * so the practical effect is the same — starts with one row, same as
 * `CreateBoqForm`).
 *
 * NO `salePrice` FIELD ON THIS FORM, AND NONE FETCHED FOR IT EITHER —
 * see `actions.ts`'s own `createInstallmentSchedule` doc comment for
 * why: the backend's own `BadRequestException` already names both the
 * typed total and the actual sale price when they don't match (within
 * a 0.01 tolerance), the same "let the backend validate, surface its
 * error" posture `ConvertReservationForm`'s own `salePrice` field
 * already took for its own `@IsPositive()` check.
 *
 * `dueDate` is a native `type="date"` field per row — same
 * `CreateIssueDto.dueDate`/`ConvertReservationForm`'s own
 * `allocationDate` precedent (backend takes a plain ISO date string,
 * exactly what a date input's own `value` already is).
 *
 * ADDENDUM (FE-10.31, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add
 * installment), same fix `SubdividePlotsForm`/`CreateMasterPlanForm`
 * each got in this same batch. Verified directly against this file's
 * own current source before fixing.
 */
export function CreateInstallmentScheduleForm({ unitId, allocationId }: { unitId: string; allocationId: string }) {
  const [rows, setRows] = React.useState<InstallmentRow[]>([{ ...EMPTY_ROW }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateRow(index: number, field: keyof InstallmentRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createInstallmentSchedule(
      unitId,
      allocationId,
      rows.map((row) => ({ dueDate: row.dueDate, amountDue: Number(row.amountDue) })),
    );

    setPending(false);
    if (result.ok) {
      setRows([{ ...EMPTY_ROW }]);
    } else {
      setError(result.error ?? 'Failed to create installment schedule.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
      {rows.map((row, index) => (
        <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
          <TextField
            label={`Due date (installment ${index + 1})`}
            type="date"
            value={row.dueDate}
            onChange={(e) => updateRow(index, 'dueDate', e.target.value)}
            required
            style={{ minWidth: '160px' }}
          />
          <TextField
            label={`Amount due (installment ${index + 1})`}
            type="number"
            value={row.amountDue}
            onChange={(e) => updateRow(index, 'amountDue', e.target.value)}
            required
            style={{ minWidth: '160px' }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => removeRow(index)}
            disabled={rows.length === 1}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={addRow}
        style={{ alignSelf: 'flex-start' }}
      >
        + Add installment
      </Button>
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create installment schedule'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
