'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createARInvoice } from './actions';

interface Line {
  description: string;
  accountId: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_LINE: Line = { description: '', accountId: '', quantity: '', unitPrice: '' };

/**
 * Frontend Completion, AR.2 — the direct mirror of AP.2's
 * `CreateAPInvoiceForm`, same plain-`Line[]`-local-state shape (still
 * only a third real consumer of the add/remove-line pattern
 * `CreateBudgetForm` established; not yet extracted into `@7f/ui`).
 *
 * `CreateARInvoiceLineDto` is NOT a direct mirror of
 * `CreateAPInvoiceLineDto` the way AP.2's own report warned — it has
 * three optional per-line fields (`projectId`, `phaseId`,
 * `vatTaxCodeId`) alongside the four required ones (`description`,
 * `accountId`, `quantity`, `unitPrice`). Per this codebase's own
 * scoping discipline (Budgeting's five optional dimension ids,
 * deliberately left out of `CreateBudgetForm`), all three are left out
 * here too:
 * - `projectId`/`phaseId`: `GET /dimensions/projects` exists but is
 *   still unused anywhere in this app (confirmed directly — the same
 *   "no registry used yet" finding every prior Frontend Completion
 *   report has carried forward unchanged); wiring a project picker in
 *   here would be new precedent, not a small addition.
 * - `vatTaxCodeId`: `GET /tax/codes?taxType=VAT` exists but requires
 *   `tax.view` (confirmed directly against `TaxController`'s own
 *   decorator) — a permission this page doesn't currently gate on
 *   (`ar.manage`/`ap.view` only). Adding a VAT code `Select` here would
 *   mean either fetching it unconditionally (a silent new permission
 *   dependency for every visitor of this page) or a real conditional-
 *   permission decision — deliberately deferred, not attempted this
 *   checkpoint.
 *
 * `accountId` is a real `Select` (`GET /accounts/entity/:entityId/active`,
 * the same registry every other line-item form in this app already
 * uses). `customerId` is also a real `Select` — `GET
 * /dimensions/customers` (`DimensionsController.findCustomers`,
 * confirmed directly) exists and, like vendors, takes no `entityId`
 * filter (customers are a global dimension too).
 *
 * `unitPrice` (not `unitCost`) is `CreateARInvoiceLineDto`'s own field
 * name — kept as-is rather than normalized to match AP's `unitCost`,
 * since this form's payload shape must match the DTO it posts to.
 *
 * ADDENDUM (FE-10.30, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add line),
 * same fix `CreateAPInvoiceForm`'s own sibling ADDENDUM in this same
 * batch just applied. Verified directly against this file's own
 * current source before fixing.
 */
export function CreateARInvoiceForm({
  entityId,
  customerOptions,
  accountOptions,
}: {
  entityId: string;
  customerOptions: SelectOption[];
  accountOptions: SelectOption[];
}) {
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [customerId, setCustomerId] = React.useState('');
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

    const result = await createARInvoice({
      entityId,
      invoiceNumber,
      customerId,
      invoiceDate,
      dueDate: dueDate || undefined,
      lines: lines.map((line) => ({
        description: line.description,
        accountId: line.accountId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
    });

    setPending(false);
    if (result.ok) {
      setInvoiceNumber('');
      setCustomerId('');
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
          label="Customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          options={customerOptions}
          placeholder="Select a customer…"
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
              label={`Unit price (line ${index + 1})`}
              type="number"
              value={line.unitPrice}
              onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
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
