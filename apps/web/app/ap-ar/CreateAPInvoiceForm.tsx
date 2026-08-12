'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createAPInvoice } from './actions';

interface Line {
  description: string;
  accountId: string;
  quantity: string;
  unitCost: string;
}

const EMPTY_LINE: Line = { description: '', accountId: '', quantity: '', unitCost: '' };

/**
 * Frontend Completion, AP.2 — the second dynamic add/remove-line form
 * in this app, same shape `CreateBudgetForm` (BUD.2) established: plain
 * `Line[]` local state, no generic `<FieldArray>` component (still only
 * a second real consumer, not yet the "second real consumer justifies
 * an abstraction" bar `Select`'s own doc comment sets — noted directly
 * in `CreateBudgetForm`'s own doc comment as the reason it stayed
 * one-off too).
 *
 * `CreateAPInvoiceLineDto` has exactly four fields — `description`,
 * `accountId`, `quantity`, `unitCost` — all required, all exposed here;
 * no optional-field scoping decision was needed the way Budgeting's own
 * five optional dimension ids required one.
 *
 * `accountId` is a real `Select` (`GET /accounts/entity/:entityId/active`,
 * same registry `CreateBudgetForm`'s own `accountId` already uses) —
 * `page.tsx` fetches it and passes `accountOptions` down, same
 * data-fetching split every `Select` consumer in this app follows.
 *
 * `vendorId` is also a real `Select` — unlike Budgeting/Risks/Issues'
 * one-off ids with no registry, `GET /dimensions/vendors`
 * (`DimensionsController.findVendors`, confirmed directly) already
 * exists and takes no `entityId` filter (vendors are a global
 * dimension, not entity-scoped) — `page.tsx` fetches it once and passes
 * `vendorOptions` down the same way.
 *
 * `purchaseOrderId` is NOT a field here — `CreateAPInvoiceDto` itself
 * doesn't accept it (confirmed directly against that DTO's own doc
 * comment: PO-backed invoices post through Procurement's own PR→PO→GRN
 * three-way-match flow instead), so there's nothing to build a picker
 * for.
 *
 * ADDENDUM (FE-10.30, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add line),
 * the same fix this rollout has now applied to every other dynamic
 * line-item form. Verified directly against this file's own current
 * source before fixing, not against a remembered file count.
 */
export function CreateAPInvoiceForm({
  entityId,
  vendorOptions,
  accountOptions,
}: {
  entityId: string;
  vendorOptions: SelectOption[];
  accountOptions: SelectOption[];
}) {
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [vendorId, setVendorId] = React.useState('');
  const [invoiceDate, setInvoiceDate] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
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

    const result = await createAPInvoice({
      entityId,
      invoiceNumber,
      vendorId,
      invoiceDate,
      dueDate: dueDate || undefined,
      lines: lines.map((line) => ({
        description: line.description,
        accountId: line.accountId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
      })),
    });

    setPending(false);
    if (result.ok) {
      setInvoiceNumber('');
      setVendorId('');
      setInvoiceDate('');
      setDueDate('');
      setLines([{ ...EMPTY_LINE }]);
    } else {
      setError(result.error ?? 'Failed to create invoice.');
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
        <TextField
          label="Invoice number"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
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
          label="Invoice date"
          type="date"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
        <TextField
          label="Due date (optional)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{ minWidth: '160px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Invoice lines</span>
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Description (line ${index + 1})`}
              value={line.description}
              onChange={(e) => updateLine(index, 'description', e.target.value)}
              required
              style={{ minWidth: '220px' }}
            />
            <Select
              label={`Account (line ${index + 1})`}
              value={line.accountId}
              onChange={(e) => updateLine(index, 'accountId', e.target.value)}
              options={accountOptions}
              placeholder="Select an account…"
              required
              style={{ minWidth: '220px' }}
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
              style={{ minWidth: '140px' }}
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
          {pending ? 'Creating…' : 'Create invoice'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
