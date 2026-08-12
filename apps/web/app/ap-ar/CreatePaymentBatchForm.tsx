'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createPaymentBatch } from './actions';

/**
 * Frontend Completion, AP.4 — see `actions.ts`'s own doc comment for
 * the full scoping rationale. On success, this form displays the newly
 * created batch's own id inline (copyable, monospace) rather than
 * clearing back to blank the way every other `Create*Form` on this page
 * does — `createPaymentBatch`'s own `batchId` is the ONLY place that id
 * is ever surfaced anywhere in this app (no list/detail read endpoint
 * exists for this resource), so silently discarding it after a
 * successful submit would leave the user with a batch they have no way
 * to find again.
 */
export function CreatePaymentBatchForm({ entityId }: { entityId: string }) {
  const [batchNumber, setBatchNumber] = React.useState('');
  const [paymentDate, setPaymentDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdBatchId, setCreatedBatchId] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setCreatedBatchId(null);

    const result = await createPaymentBatch({ entityId, batchNumber, paymentDate });

    setPending(false);
    if (result.ok && result.batchId) {
      setCreatedBatchId(result.batchId);
      setBatchNumber('');
      setPaymentDate('');
    } else {
      setError(result.error ?? 'Failed to create payment batch.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        padding: tokens.space(4),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.space(4),
      }}
    >
      <TextField
        label="Batch number"
        value={batchNumber}
        onChange={(e) => setBatchNumber(e.target.value)}
        required
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Payment date"
        type="date"
        value={paymentDate}
        onChange={(e) => setPaymentDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create payment batch'}
      </Button>
      {createdBatchId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
          <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.positive }}>
            Batch created — copy its id below to approve or process it (this app has no other way to look it up).
          </span>
          <code
            style={{
              fontFamily: tokens.font.mono,
              fontSize: '12px',
              color: tokens.color.textPrimary,
              background: tokens.color.surfaceRaised,
              padding: `${tokens.space(1)} ${tokens.space(2)}`,
              borderRadius: tokens.radius.sm,
              userSelect: 'all',
            }}
          >
            {createdBatchId}
          </code>
        </div>
      )}
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{error}</span>}
    </form>
  );
}
