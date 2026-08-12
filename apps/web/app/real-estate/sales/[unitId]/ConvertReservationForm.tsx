'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { convertReservation } from './actions';

/**
 * Frontend Completion — Convert Reservation to Sale, FE-4.9's own
 * recommended next checkpoint. `ConvertReservationRequestDto` (read
 * directly) is a flat, ALL-REQUIRED five-field object — `salePrice`,
 * `allocationDate`, `invoiceNumber`, `revenueAccountId`,
 * `arControlAccountId` — genuinely bigger and differently-shaped than
 * `CancelCurrentForm`'s own single `reason` field, which is why this is
 * a separate component rather than a third `kind` on that one: no field
 * is shared between the two beyond the `reservationId`/`unitId` pair
 * both act on.
 *
 * `revenueAccountId`/`arControlAccountId` are both real `Select`s fed by
 * a caller-supplied `accountOptions` prop — reuses `GET
 * /accounts/entity/:entityId/active` exactly the way `CreateAPInvoiceForm`/
 * `CreateARInvoiceForm`/`PostARInvoiceButton` already do on `/ap-ar`
 * (confirmed directly by reading `PostARInvoiceButton.tsx`'s own doc
 * comment first, per this checkpoint's own recommendation): the SAME
 * full active-accounts list serves both fields here too, no separate
 * "revenue accounts only" or "AR control accounts only" filtered subset
 * exists on this backend to narrow either `Select` down to, the same
 * reasoning `PostARInvoiceButton`'s own doc comment already gives for
 * reusing one unfiltered list across two differently-named account
 * fields.
 *
 * `allocationDate` is a native `type="date"` `TextField` — same
 * `CreateIssueDto.dueDate`/`CreateIssueForm`'s own precedent: the
 * backend takes a plain ISO date string (`@IsString()`, used server-side
 * as `new Date(dto.allocationDate)`), which is exactly what a date
 * input's own `value` already is.
 *
 * `salePrice` is `@IsPositive()`, not just `@Min(0)` like most optional
 * numeric fields elsewhere in this app — this form's own `TextField`
 * doesn't attempt to replicate that client-side (no `min` attribute
 * added); the backend's own validation is the actual gate, same
 * "the backend already validates this" posture `BrandingProfileForm`'s
 * own hex-color fields already took.
 */
export function ConvertReservationForm({
  unitId,
  reservationId,
  accountOptions,
}: {
  unitId: string;
  reservationId: string;
  accountOptions: SelectOption[];
}) {
  const [salePrice, setSalePrice] = React.useState('');
  const [allocationDate, setAllocationDate] = React.useState('');
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [revenueAccountId, setRevenueAccountId] = React.useState('');
  const [arControlAccountId, setArControlAccountId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await convertReservation(unitId, reservationId, {
      salePrice: Number(salePrice),
      allocationDate,
      invoiceNumber,
      revenueAccountId,
      arControlAccountId,
    });

    setPending(false);
    if (result.ok) {
      setSalePrice('');
      setAllocationDate('');
      setInvoiceNumber('');
      setRevenueAccountId('');
      setArControlAccountId('');
    } else {
      setError(result.error ?? 'Failed to convert reservation to sale.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}
    >
      <TextField
        label="Sale price"
        type="number"
        value={salePrice}
        onChange={(e) => setSalePrice(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Allocation date"
        type="date"
        value={allocationDate}
        onChange={(e) => setAllocationDate(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Invoice number"
        value={invoiceNumber}
        onChange={(e) => setInvoiceNumber(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Revenue account"
        value={revenueAccountId}
        onChange={(e) => setRevenueAccountId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="AR control account"
        value={arControlAccountId}
        onChange={(e) => setArControlAccountId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Converting…' : 'Convert to sale'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
