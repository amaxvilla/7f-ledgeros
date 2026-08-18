'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, TextField, tokens } from '@7f/ui';
import { createPayrollRun } from './actions';

export function CreatePayrollRunForm({
  entityId,
}: {
  entityId: string;
}) {
  const router = useRouter();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [payPeriodName, setPayPeriodName] = React.useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
  );
  const [payPeriodStart, setPayPeriodStart] = React.useState(
    monthStart.toISOString().slice(0, 10),
  );
  const [payPeriodEnd, setPayPeriodEnd] = React.useState(
    monthEnd.toISOString().slice(0, 10),
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!payPeriodName.trim()) {
      setError('Enter a pay period name.');
      return;
    }

    if (!payPeriodStart || !payPeriodEnd) {
      setError('Enter both the pay-period start and end dates.');
      return;
    }

    if (payPeriodEnd < payPeriodStart) {
      setError('Pay-period end date cannot be before the start date.');
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    const result = await createPayrollRun(
      entityId,
      payPeriodName.trim(),
      payPeriodStart,
      payPeriodEnd,
    );

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(
      `Payroll run ${payPeriodName.trim()} created in DRAFT status.`,
    );
    router.refresh();
  }

  return (
    <div
      style={{
        padding: tokens.space(4),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.space(8),
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: tokens.space(3),
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <TextField
          label="Pay period"
          value={payPeriodName}
          onChange={(event) => setPayPeriodName(event.target.value)}
          placeholder="2026-08"
        />

        <TextField
          label="Start date"
          type="date"
          value={payPeriodStart}
          onChange={(event) => setPayPeriodStart(event.target.value)}
        />

        <TextField
          label="End date"
          type="date"
          value={payPeriodEnd}
          onChange={(event) => setPayPeriodEnd(event.target.value)}
        />

        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create payroll run'}
        </Button>
      </form>

      {success && (
        <div
          style={{
            marginTop: tokens.space(3),
            color: tokens.color.positive,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          {success}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: tokens.space(3),
            color: tokens.color.negative,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
