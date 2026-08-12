'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { transferAllocation } from './actions';

/**
 * Frontend Completion, FE-4.11 — Transfer Allocation, one of the last
 * remaining pair FE-4.10's own report named. `TransferAllocationDto`
 * (read directly) is `{ newCustomerId: string; reason: string }` — a
 * genuinely smaller DTO than `ConvertReservationRequestDto`'s own five
 * fields, but still not a `CancelCurrentForm`-shaped single-field form,
 * hence its own component rather than a third `kind` there.
 *
 * `newCustomerId` is a real `Select` fed by a caller-supplied
 * `customerOptions` prop — `GET /dimensions/customers` (confirmed
 * directly: no parameters, no `entityId` filter — `Customer` has no
 * such column) is already fetched by `sales/page.tsx` for
 * `ReserveUnitForm`'s own customer picker; this page fetches it again
 * itself (folded into its own existing `Promise.all` alongside the
 * project tree, event log, and accounts) rather than threading it down
 * from a different route's page component, the same "each page fetches
 * its own data" discipline this app has followed throughout, not a new
 * exception for this one field.
 */
export function TransferAllocationForm({
  unitId,
  allocationId,
  customerOptions,
}: {
  unitId: string;
  allocationId: string;
  customerOptions: SelectOption[];
}) {
  const [newCustomerId, setNewCustomerId] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await transferAllocation(unitId, allocationId, newCustomerId, reason);

    setPending(false);
    if (result.ok) {
      setNewCustomerId('');
      setReason('');
    } else {
      setError(result.error ?? 'Failed to transfer allocation.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
      <Select
        label="New customer"
        value={newCustomerId}
        onChange={(e) => setNewCustomerId(e.target.value)}
        options={customerOptions}
        placeholder="Select a customer…"
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required style={{ minWidth: '260px' }} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Transferring…' : 'Transfer allocation'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
