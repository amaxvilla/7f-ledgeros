'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createPaymentVoucher } from './actions';

interface Allocation {
  vendorInvoiceId: string;
  amountAllocated: string;
}

const EMPTY_ALLOCATION: Allocation = { vendorInvoiceId: '', amountAllocated: '' };

const PAYMENT_METHOD_OPTIONS: SelectOption[] = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
];

/**
 * Frontend Completion, AP.5 — `CreatePaymentVoucherDto`'s own create
 * form, AP.4's own recommended next checkpoint. Reuses the add/remove-
 * row `allocations[]` state shape `CreateARInvoiceForm`'s own `lines[]`
 * already established (still no shared `@7f/ui` primitive for this).
 *
 * `vendorId` reuses `data.vendorOptions` (already fetched on this page).
 * `vendorInvoiceId` (per allocation row) is a real `Select` too — built
 * from `data.invoices` (`GET /ap/invoices`, already fetched for the
 * existing AP register on this page) rather than a plain `TextField`,
 * since real, resolvable invoice ids are already sitting in this page's
 * own data with no new fetch required.
 *
 * `batchId` (optional) and `bankAccountId` (required) are both plain
 * `TextField`s, not `Select`s — `batchId` for the same "no read endpoint
 * exists for this resource" reason `PaymentBatchActions.tsx` already
 * established; `bankAccountId` because `GET /treasury/bank-accounts`
 * requires `treasury.view`, confirmed directly as a permission this
 * page has never gated on (`ap.manage`/`ap.view`/`ap.approve`/`ap.pay`
 * only) — the same "a new cross-permission registry dependency is a
 * real decision, not made here" posture `CreateARInvoiceForm`'s own doc
 * comment already took for its own deferred `vatTaxCodeId` picker.
 *
 * Six of `PaymentAllocationDto`'s ten fields are deliberately left off
 * each row (`whtRate`/`whtTaxAuthorityAccountId`/`whtTaxCodeId`/
 * `vatRate`/`vatTaxAuthorityAccountId`/`vatTaxCodeId`, all optional) —
 * this app's own "required fields only, defer pickers that don't exist
 * yet" discipline (Budgeting's five optional dimension ids;
 * `CreateARInvoiceForm`'s own three deferred optional fields), re-
 * applied rather than re-argued.
 *
 * On success, this form displays the newly created voucher's own id
 * inline, the same convention `CreatePaymentBatchForm.tsx` established
 * — no voucher list/table is fetched or rendered anywhere on this page.
 *
 * ADDENDUM (FE-10.30, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add
 * allocation), same fix `CreateAPInvoiceForm`/`CreateARInvoiceForm`
 * each got in this same batch. Verified directly against this file's
 * own current source before fixing.
 */
export function CreatePaymentVoucherForm({
  entityId,
  vendorOptions,
  invoiceOptions,
}: {
  entityId: string;
  vendorOptions: SelectOption[];
  invoiceOptions: SelectOption[];
}) {
  const [voucherNumber, setVoucherNumber] = React.useState('');
  const [vendorId, setVendorId] = React.useState('');
  const [batchId, setBatchId] = React.useState('');
  const [paymentDate, setPaymentDate] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [bankAccountId, setBankAccountId] = React.useState('');
  const [allocations, setAllocations] = React.useState<Allocation[]>([{ ...EMPTY_ALLOCATION }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdVoucherId, setCreatedVoucherId] = React.useState<string | null>(null);

  function updateAllocation(index: number, field: keyof Allocation, value: string) {
    setAllocations((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function addAllocation() {
    setAllocations((prev) => [...prev, { ...EMPTY_ALLOCATION }]);
  }

  function removeAllocation(index: number) {
    setAllocations((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setCreatedVoucherId(null);

    const result = await createPaymentVoucher({
      entityId,
      voucherNumber,
      vendorId,
      batchId: batchId || undefined,
      paymentDate,
      paymentMethod,
      bankAccountId,
      allocations: allocations.map((a) => ({
        vendorInvoiceId: a.vendorInvoiceId,
        amountAllocated: Number(a.amountAllocated),
      })),
    });

    setPending(false);
    if (result.ok && result.voucherId) {
      setCreatedVoucherId(result.voucherId);
      setVoucherNumber('');
      setVendorId('');
      setBatchId('');
      setPaymentDate('');
      setPaymentMethod('');
      setBankAccountId('');
      setAllocations([{ ...EMPTY_ALLOCATION }]);
    } else {
      setError(result.error ?? 'Failed to create payment voucher.');
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
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
        <TextField label="Voucher number" value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} required style={{ minWidth: '180px' }} />
        <Select label="Vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} options={vendorOptions} placeholder="Select a vendor…" required style={{ minWidth: '220px' }} />
        <TextField label="Batch ID (optional)" value={batchId} onChange={(e) => setBatchId(e.target.value)} style={{ minWidth: '200px' }} />
        <TextField label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        <Select label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={PAYMENT_METHOD_OPTIONS} placeholder="Select a method…" required style={{ minWidth: '180px' }} />
        <TextField label="Bank account ID" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required style={{ minWidth: '220px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Invoice allocations</span>
        {allocations.map((a, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <Select
              label={`Vendor invoice (line ${index + 1})`}
              value={a.vendorInvoiceId}
              onChange={(e) => updateAllocation(index, 'vendorInvoiceId', e.target.value)}
              options={invoiceOptions}
              placeholder="Select an invoice…"
              required
              style={{ minWidth: '220px' }}
            />
            <TextField
              label="Amount allocated"
              type="number"
              min="0.01"
              step="0.01"
              value={a.amountAllocated}
              onChange={(e) => updateAllocation(index, 'amountAllocated', e.target.value)}
              required
              style={{ minWidth: '160px' }}
            />
            <Button type="button" variant="secondary" onClick={() => removeAllocation(index)} disabled={allocations.length === 1}>
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addAllocation} style={{ alignSelf: 'flex-start' }}>
          + Add allocation
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2) }}>
        <Button type="submit" disabled={pending} style={{ alignSelf: 'flex-start' }}>
          {pending ? 'Creating…' : 'Create payment voucher'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
        {createdVoucherId && (
          <div style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>
            Created voucher <code style={{ background: tokens.color.surfaceRaised, padding: `2px ${tokens.space(1)}`, borderRadius: tokens.radius.sm }}>{createdVoucherId}</code>
          </div>
        )}
      </div>
    </form>
  );
}
