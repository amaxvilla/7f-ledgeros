'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createPurchaseOrder } from './actions';

interface Line {
  description: string;
  accountId: string;
  budgetLineId: string;
  quantity: string;
  unitCost: string;
}

const EMPTY_LINE: Line = { description: '', accountId: '', budgetLineId: '', quantity: '1', unitCost: '0' };

/**
 * Frontend Completion, FE-3.3 — same dynamic-line pattern as
 * `CreateRequisitionForm`. `CreatePurchaseOrderDto.lines` also requires
 * `@ArrayMinSize(1)` (confirmed directly), so one starting line.
 *
 * `vendorId` is a real `Select` sourced from `vendorOptions` — Vendor's
 * own registry (`GET /dimensions/vendors`) shipped in FE-3.2, so unlike
 * `budgetLineId` below there's no reason to leave this one as a bare
 * `TextField`. `requisitionId` (optional) stays a plain `TextField`:
 * `CreatePurchaseOrderDto.requisitionId` is a real optional field
 * (confirmed directly — a PO can be raised against an approved
 * requisition), but building a picker for it means fetching and
 * filtering this entity's APPROVED requisitions specifically, which
 * `page.tsx` doesn't currently do (it fetches the full unfiltered list)
 * — left as an id field for a later checkpoint to upgrade once that
 * filtered fetch exists, the same "known gap, not silently dropped"
 * posture `CreateJournalEntryForm`'s own doc comment takes for its
 * left-out dimension ids.
 *
 * `budgetLineId` per line is REQUIRED on the DTO (`@IsString()`, no
 * `@IsOptional()` — confirmed directly, unlike the requisition line's
 * own optional `budgetLineId`), so this form can't leave it off the way
 * `CreateRequisitionForm` does — it's a plain required `TextField`
 * instead, for the same "no registry to build a Select from yet" reason
 * given there.
 *
 * ADDENDUM (FE-10.25, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add line),
 * same fix `CreateRequisitionForm`'s own sibling ADDENDUM in this same
 * batch just applied. Verified directly against this file's own
 * current source before fixing.
 */
export function CreatePurchaseOrderForm({
  entityId,
  accountOptions,
  vendorOptions,
}: {
  entityId: string;
  accountOptions: SelectOption[];
  vendorOptions: SelectOption[];
}) {
  const [poNumber, setPoNumber] = React.useState('');
  const [vendorId, setVendorId] = React.useState('');
  const [orderDate, setOrderDate] = React.useState('');
  const [requisitionId, setRequisitionId] = React.useState('');
  const [lines, setLines] = React.useState<Line[]>([{ ...EMPTY_LINE }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createPurchaseOrder({
      entityId,
      poNumber,
      vendorId,
      orderDate,
      requisitionId: requisitionId || undefined,
      lines: lines.map((line) => ({
        description: line.description,
        accountId: line.accountId,
        budgetLineId: line.budgetLineId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
      })),
    });

    setPending(false);
    if (result.ok) {
      setPoNumber('');
      setVendorId('');
      setOrderDate('');
      setRequisitionId('');
      setLines([{ ...EMPTY_LINE }]);
    } else {
      setError(result.error ?? 'Failed to create purchase order.');
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
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
        <TextField label="PO number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required style={{ minWidth: '160px' }} />
        <Select
          label="Vendor"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          options={vendorOptions}
          placeholder="Select a vendor…"
          required
          style={{ minWidth: '220px' }}
        />
        <TextField
          label="Order date"
          type="date"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
        <TextField
          label="Requisition ID (optional)"
          value={requisitionId}
          onChange={(e) => setRequisitionId(e.target.value)}
          style={{ minWidth: '200px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Lines</span>
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Description (line ${index + 1})`}
              value={line.description}
              onChange={(e) => updateLine(index, 'description', e.target.value)}
              required
              style={{ minWidth: '200px' }}
            />
            <Select
              label={`Account (line ${index + 1})`}
              value={line.accountId}
              onChange={(e) => updateLine(index, 'accountId', e.target.value)}
              options={accountOptions}
              placeholder="Select an account…"
              required
              style={{ minWidth: '200px' }}
            />
            <TextField
              label={`Budget line ID (line ${index + 1})`}
              value={line.budgetLineId}
              onChange={(e) => updateLine(index, 'budgetLineId', e.target.value)}
              required
              style={{ minWidth: '180px' }}
            />
            <TextField
              label={`Quantity (line ${index + 1})`}
              type="number"
              value={line.quantity}
              onChange={(e) => updateLine(index, 'quantity', e.target.value)}
              required
              style={{ minWidth: '120px' }}
            />
            <TextField
              label={`Unit cost (line ${index + 1})`}
              type="number"
              value={line.unitCost}
              onChange={(e) => updateLine(index, 'unitCost', e.target.value)}
              required
              style={{ minWidth: '120px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addLine}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add line
        </Button>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create purchase order'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
