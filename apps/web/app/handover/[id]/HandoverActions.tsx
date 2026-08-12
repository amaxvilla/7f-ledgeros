'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { cancelHandover, completeHandover, inspectHandover } from '../actions';

/**
 * Frontend Completion, FE-4.1. Not `PmoStatusActions` — confirmed
 * directly (`HandoverService`, not `advanceGeneric`/`WORKFLOW_ORDER`)
 * that Handover's own transitions aren't a single linear "advance one
 * step" sequence: `inspect` and `cancel` are both valid from
 * `SCHEDULED`, `INSPECTION_DONE`, AND `SNAGS_PENDING` alike
 * (`assertHandoverOpen` only blocks `COMPLETED`/`CANCELLED`), and
 * `complete` additionally refuses server-side while any snag is still
 * `OPEN`/`IN_PROGRESS` (`completeHandover`'s own open-snag count check)
 * — three independently-available actions, not one "next status" button,
 * so this is its own component rather than a second consumer of that
 * PMO-specific one.
 *
 * `complete`'s seven GL fields are all plain `TextField`s, same
 * "opaque ID, no registry" shape `ScheduleHandoverForm`'s own fields
 * use — `CompleteHandoverDto`'s own doc comment names these as GL
 * identifiers "needed to reuse RevenueRecognitionService.recognizeOnHandover()
 * as-is"; no `GET /accounts` `Select` wiring is in this checkpoint's
 * scope (General Ledger's own `page.tsx` doesn't expose one for reuse
 * here either — confirmed directly, not assumed).
 */
export function HandoverActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cancelReason, setCancelReason] = React.useState('');
  const [showComplete, setShowComplete] = React.useState(false);
  const [entryDate, setEntryDate] = React.useState('');
  const [salePrice, setSalePrice] = React.useState('');
  const [costOfUnit, setCostOfUnit] = React.useState('');
  const [deferredRevenueGlId, setDeferredRevenueGlId] = React.useState('');
  const [propertySalesRevenueGlId, setPropertySalesRevenueGlId] = React.useState('');
  const [costOfSalesGlId, setCostOfSalesGlId] = React.useState('');
  const [propertyInventoryGlId, setPropertyInventoryGlId] = React.useState('');

  if (status === 'COMPLETED' || status === 'CANCELLED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>—</span>;
  }

  async function handleInspect() {
    setPending('inspect');
    setError(null);
    const result = await inspectHandover(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to record inspection.');
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      setError('A cancellation reason is required.');
      return;
    }
    setPending('cancel');
    setError(null);
    const result = await cancelHandover(id, cancelReason.trim());
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to cancel handover.');
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setPending('complete');
    setError(null);
    const result = await completeHandover(id, {
      entryDate,
      salePrice: Number(salePrice),
      costOfUnit: Number(costOfUnit),
      deferredRevenueGlId,
      propertySalesRevenueGlId,
      costOfSalesGlId,
      propertyInventoryGlId,
    });
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to complete handover.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(4) }}>
      <div style={{ display: 'flex', gap: tokens.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
        <Button type="button" variant="primary" disabled={pending !== null} onClick={handleInspect}>
          {pending === 'inspect' ? 'Recording…' : 'Record inspection'}
        </Button>
        <TextField
          label="Cancellation reason"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          disabled={pending !== null}
          style={{ minWidth: '220px' }}
        />
        <Button type="button" variant="secondary" disabled={pending !== null} onClick={handleCancel}>
          {pending === 'cancel' ? 'Cancelling…' : 'Cancel handover'}
        </Button>
        <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => setShowComplete((s) => !s)}>
          {showComplete ? 'Hide complete form' : 'Complete handover'}
        </Button>
      </div>

      {showComplete && (
        <form
          onSubmit={handleComplete}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: tokens.space(3),
            alignItems: 'flex-end',
            padding: tokens.space(4),
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
          }}
        >
          <TextField label="Entry date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required style={{ minWidth: '160px' }} />
          <TextField label="Sale price" type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required style={{ minWidth: '160px' }} />
          <TextField label="Cost of unit" type="number" value={costOfUnit} onChange={(e) => setCostOfUnit(e.target.value)} required style={{ minWidth: '160px' }} />
          <TextField label="Deferred revenue GL ID" value={deferredRevenueGlId} onChange={(e) => setDeferredRevenueGlId(e.target.value)} required style={{ minWidth: '200px' }} />
          <TextField label="Property sales revenue GL ID" value={propertySalesRevenueGlId} onChange={(e) => setPropertySalesRevenueGlId(e.target.value)} required style={{ minWidth: '200px' }} />
          <TextField label="Cost of sales GL ID" value={costOfSalesGlId} onChange={(e) => setCostOfSalesGlId(e.target.value)} required style={{ minWidth: '200px' }} />
          <TextField label="Property inventory GL ID" value={propertyInventoryGlId} onChange={(e) => setPropertyInventoryGlId(e.target.value)} required style={{ minWidth: '200px' }} />
          <Button type="submit" disabled={pending !== null}>
            {pending === 'complete' ? 'Completing…' : 'Recognize revenue and complete'}
          </Button>
        </form>
      )}

      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </div>
  );
}
