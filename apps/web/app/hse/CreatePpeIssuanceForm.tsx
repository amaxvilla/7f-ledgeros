'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { issuePpe } from './actions';

/**
 * Frontend Completion, HSE.4 — see `actions.ts`'s own doc comment for
 * the full before-coding analysis. Picked over Inspection Checklists
 * as the next "one resource per checkpoint" pick for the same reason
 * HSE.3's own report gave: `CreatePpeIssuanceDto` (confirmed directly
 * in `hse.service.ts`) has no nested-array shape, unlike Inspection
 * Checklists' own `items: InspectionChecklistItem[]`.
 *
 * `employeeId` stays a plain, REQUIRED `TextField`, NOT a `Select` —
 * confirmed directly that the only employee-list endpoint in this app
 * (`GET /hr-payroll/employees`) is gated on `hr.view`, a different
 * permission scope from `hse.manage`/`hse.view`/`hse.report` (all three
 * already used elsewhere on this page) — wiring a cross-module fetch
 * gated on a permission this page has never assumed the caller holds
 * is a real decision this checkpoint doesn't make unilaterally, the
 * same "no Users/Employees registry reachable from here" reasoning
 * every other free-text assignee/conductor field on this page already
 * follows (`assignedToId`, `conductedById`).
 *
 * No `projectId` field — confirmed directly that `CreatePpeIssuanceDto`
 * has no `projectId` of its own (unlike Incidents/Near Misses/Toolbox
 * Talks), so `projectOptions` isn't threaded into this form.
 */
export function CreatePpeIssuanceForm({ entityId }: { entityId: string }) {
  const [employeeId, setEmployeeId] = React.useState('');
  const [itemName, setItemName] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [issuedDate, setIssuedDate] = React.useState('');
  const [expiryDate, setExpiryDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await issuePpe({
      entityId,
      employeeId,
      itemName,
      quantity: Number(quantity),
      issuedDate,
      expiryDate: expiryDate || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to issue PPE.');
      return;
    }
    setEmployeeId('');
    setItemName('');
    setQuantity('');
    setIssuedDate('');
    setExpiryDate('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField
        label="Employee ID"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField label="Item" value={itemName} onChange={(e) => setItemName(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField
        label="Quantity"
        type="number"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
        style={{ minWidth: '100px' }}
      />
      <TextField label="Issued date" type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} required />
      <TextField
        label="Expiry date (optional)"
        type="date"
        value={expiryDate}
        onChange={(e) => setExpiryDate(e.target.value)}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Issuing…' : 'Issue PPE'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
