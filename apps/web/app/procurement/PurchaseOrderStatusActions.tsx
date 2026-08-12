'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { approvePurchaseOrder, rejectPurchaseOrder } from './actions';

/**
 * Frontend Completion, FE-3.3 — `DRAFT`-only, no comments field (see
 * `actions.ts`'s own doc comment: neither `approvePurchaseOrder` nor
 * `rejectPurchaseOrder` takes a body at all, unlike the requisition
 * decision endpoints `RequisitionStatusActions` calls). A rejected PO
 * moves straight to `CANCELLED` (`ProcurementService.rejectPurchaseOrder`,
 * confirmed directly) — a terminal status, so this component never
 * needs to render anything for a PO it just rejected client-side beyond
 * the dash every other terminal status already falls back to.
 *
 * ADDENDUM (FE-10.22, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed; each now renders at
 * `Button`'s own properly-sized default touch target. A 3+2 split with
 * `RequisitionStatusActions.tsx` (its own sibling ADDENDUM) — this file
 * has no comments field at all, so the `TextField`-`id` gap named there
 * doesn't apply here.
 */
export function PurchaseOrderStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState<'approve' | 'reject' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleApprove() {
    setPending('approve');
    setError(null);
    const result = await approvePurchaseOrder(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to approve purchase order.');
  }

  async function handleReject() {
    setPending('reject');
    setError(null);
    const result = await rejectPurchaseOrder(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to reject purchase order.');
  }

  if (status !== 'DRAFT') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        <Button
          type="button"
          variant="primary"
          disabled={pending !== null}
          onClick={handleApprove}
        >
          {pending === 'approve' ? 'Approving…' : 'Approve'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={handleReject}
        >
          {pending === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
