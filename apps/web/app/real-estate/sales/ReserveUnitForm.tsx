'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { reserveUnit } from './actions';

/**
 * Frontend Completion — `ReserveUnitForm`. `unitOptions` is pre-filtered
 * by the calling page to `AVAILABLE` units only (`RealEstateService
 * .reserveUnit`'s own guard throws `ConflictException` for any other
 * status, confirmed directly) — not re-checked here, since the page
 * already built this exact list for the Units table above this form
 * from the same `getProjectTree` response.
 *
 * `customerOptions` comes from `GET /dimensions/customers` — genuinely
 * unscoped by entity (`Customer` has no `entityId` column at all,
 * confirmed directly against the Prisma model — unlike `Unit`, which is
 * scoped transitively through `Project`), so the same customer list
 * applies regardless of which entity/project is currently selected.
 *
 * `expiresInHours`/`reservationFee` are both optional `TextField`s,
 * sent through as `undefined` when blank — `RealEstateService
 * .reserveUnit`'s own `DEFAULT_RESERVATION_HOURS` (72) applies
 * server-side when `expiresInHours` is omitted, stated in the field's
 * own placeholder rather than hardcoded into this form as a default
 * value (the number belongs to the backend, not duplicated here).
 */
export function ReserveUnitForm({
  entityId,
  projectId,
  unitOptions,
  customerOptions,
}: {
  entityId: string;
  projectId: string;
  unitOptions: SelectOption[];
  customerOptions: SelectOption[];
}) {
  const [unitId, setUnitId] = React.useState('');
  const [customerId, setCustomerId] = React.useState('');
  const [expiresInHours, setExpiresInHours] = React.useState('');
  const [reservationFee, setReservationFee] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await reserveUnit({
      unitId,
      customerId,
      entityId,
      projectId,
      expiresInHours: expiresInHours ? Number(expiresInHours) : undefined,
      reservationFee: reservationFee ? Number(reservationFee) : undefined,
    });

    setPending(false);
    if (result.ok) {
      setUnitId('');
      setCustomerId('');
      setExpiresInHours('');
      setReservationFee('');
      setSuccess(true);
    } else {
      setError(result.error ?? 'Failed to reserve unit.');
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
      <Select
        label="Unit"
        value={unitId}
        onChange={(e) => setUnitId(e.target.value)}
        options={unitOptions}
        placeholder="Select an available unit…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Customer"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        options={customerOptions}
        placeholder="Select a customer…"
        required
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Expires in (hours, optional)"
        type="number"
        value={expiresInHours}
        onChange={(e) => setExpiresInHours(e.target.value)}
        placeholder="72"
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Reservation fee (optional)"
        type="number"
        value={reservationFee}
        onChange={(e) => setReservationFee(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Reserving…' : 'Reserve unit'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Unit reserved.</div>}
    </form>
  );
}
