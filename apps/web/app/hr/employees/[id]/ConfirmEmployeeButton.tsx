'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { confirmEmployee } from '../actions';

export function ConfirmEmployeeButton({ id, status }: { id: string; status?: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status !== 'PROBATION') return null;

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await confirmEmployee(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to confirm employee.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
      <Button type="button" disabled={pending} onClick={handleConfirm}>
        {pending ? 'Confirming…' : 'Confirm out of probation'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
