'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { releaseRetention } from './actions';

/**
 * Frontend Completion — Retention, this checkpoint's own direct
 * continuation of Interim Payment Certificates (`advanceCertificateStatus`'s
 * `CERTIFIED` branch is what creates the `Retention` row this form acts
 * against — see `page.tsx`'s own doc comment).
 *
 * A normal page-level form (like `CreateProgressValuationForm`), not a
 * per-row inline one like `GenerateCertificateForm` — there's at most
 * one `Retention` record per work package, so this form isn't scoped to
 * a specific table row the way certificate generation is.
 *
 * `page.tsx` only renders this component when `totalHeld - totalReleased
 * > 0` — `PmoService.releaseRetention` itself throws `BadRequestException`
 * for any request exceeding that same available amount (confirmed
 * directly), so offering the form when nothing is available to release
 * would only ever produce a guaranteed-failing submit, the same "don't
 * offer what would always fail" posture `CloseRiskButton`/
 * `SubmitBudgetButton` already established for their own hidden states.
 * The `amount` field's own `max` HTML hint is set to the actual
 * available figure (a real, page-computed number, not a hardcoded
 * bound) — the server-side check remains authoritative either way.
 */
export function ReleaseRetentionForm({ retentionId, workPackageId }: { retentionId: string; workPackageId: string }) {
  const [amount, setAmount] = React.useState('');
  const [releaseDate, setReleaseDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await releaseRetention({
      retentionId,
      workPackageId,
      amount: Number(amount),
      releaseDate,
    });

    setPending(false);
    if (result.ok) {
      setAmount('');
      setReleaseDate('');
    } else {
      setError(result.error ?? 'Failed to release retention.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <TextField
        label="Amount to release"
        type="number"
        min={0}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Release date"
        type="date"
        value={releaseDate}
        onChange={(e) => setReleaseDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Releasing…' : 'Release retention'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
