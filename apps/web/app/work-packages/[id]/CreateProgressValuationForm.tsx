'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createProgressValuation } from './actions';

/**
 * Frontend Completion, PMO.3 — flat header-fields form, same shape
 * `CreateWorkPackageForm` established: `CreateProgressValuationDto`
 * (confirmed directly against `pmo.service.ts`) is a plain object with
 * no nested array. `valuationNumber` is computed server-side and is
 * NOT a field here — see `actions.ts`'s own doc comment.
 *
 * `percentComplete` is a native `type="number"` `TextField` with
 * `min={0}`/`max={100}` HTML attributes as a client-side hint, but the
 * real enforcement is server-side (`BadRequestException` outside
 * 0-100, confirmed directly) — same "don't duplicate server validation
 * as a hard client block" posture `CreateBudgetForm`'s own numeric
 * fields already take.
 *
 * `valuationDate` is a native `type="date"` `TextField`, the same
 * established pattern `CreateIssueForm`'s `dueDate` and
 * `TaxPositionForm`'s period fields already use.
 */
export function CreateProgressValuationForm({ workPackageId }: { workPackageId: string }) {
  const [valuationDate, setValuationDate] = React.useState('');
  const [percentComplete, setPercentComplete] = React.useState('');
  const [valuationAmount, setValuationAmount] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createProgressValuation({
      workPackageId,
      valuationDate,
      percentComplete: Number(percentComplete),
      valuationAmount: Number(valuationAmount),
    });

    setPending(false);
    if (result.ok) {
      setValuationDate('');
      setPercentComplete('');
      setValuationAmount('');
    } else {
      setError(result.error ?? 'Failed to create progress valuation.');
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
      <TextField
        label="Valuation date"
        type="date"
        value={valuationDate}
        onChange={(e) => setValuationDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Percent complete"
        type="number"
        min={0}
        max={100}
        value={percentComplete}
        onChange={(e) => setPercentComplete(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Valuation amount"
        type="number"
        value={valuationAmount}
        onChange={(e) => setValuationAmount(e.target.value)}
        required
        style={{ minWidth: '180px' }}
      />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add progress valuation'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
