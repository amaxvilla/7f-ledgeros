'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import {
  approveCommissionCalculation,
  cancelCommissionCalculation,
  markCommissionCalculationPaid,
  markCommissionCalculationPayable,
  rejectCommissionCalculation,
  reverseCommissionCalculation,
  submitCommissionCalculation,
} from './actions';

export type CalculationStatus = 'CALCULATED' | 'PENDING' | 'APPROVED' | 'PAYABLE' | 'PAID' | 'REJECTED' | 'REVERSED' | 'CANCELLED';

const TERMINAL_LABEL: Partial<Record<CalculationStatus, string>> = {
  REJECTED: 'Rejected',
  REVERSED: 'Reversed',
  CANCELLED: 'Cancelled',
};

type ActionKey = 'submit' | 'approve' | 'reject' | 'markPayable' | 'markPaid' | 'cancel' | 'reverse';

/**
 * Agent & Commission Management, RE-COMM.3/RE-COMM.4 (frontend) —
 * Commission Lifecycle + Financial Integration. Row-level controls
 * matching the exact transition graph CommissionCalculationStatus's own
 * schema doc comment describes: CALCULATED -> PENDING -> APPROVED ->
 * PAYABLE -> PAID, with reject/cancel/reverse available at the states
 * CommissionCalculationService itself allows them from — mirrors
 * `DeactivatePlanControl`'s own "nothing renders for a terminal state"
 * pattern for REJECTED/REVERSED/CANCELLED.
 *
 * `accountOptions` (RE-COMM.4) is required for the mark-payable
 * (commission expense + payable accounts) and mark-paid (cash account)
 * steps, since those now actually post through PostingEngineService —
 * same `Select`-driven, caller-supplies-the-account convention
 * `PostAPInvoiceButton`'s own doc comment already established for this
 * exact reason (no hardcoded accounts). `adjust` is deliberately not
 * exposed here — it takes a full recalculation payload, not just a
 * reason, and belongs with a form, not a row-level button; the API
 * endpoint exists and is usable directly in the meantime.
 */
export function CalculationLifecycleControls({
  id,
  status,
  accountOptions,
}: {
  id: string;
  status: CalculationStatus;
  accountOptions: SelectOption[];
}) {
  const [reason, setReason] = React.useState('');
  const [expenseAccountId, setExpenseAccountId] = React.useState('');
  const [payableAccountId, setPayableAccountId] = React.useState('');
  const [cashAccountId, setCashAccountId] = React.useState('');
  const [paymentReference, setPaymentReference] = React.useState('');
  const [pending, setPending] = React.useState<ActionKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const terminalLabel = TERMINAL_LABEL[status];
  if (terminalLabel) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>{terminalLabel}</span>;
  }

  async function run(action: ActionKey, call: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(action);
    setError(null);
    const result = await call();
    setPending(null);
    if (!result.ok) setError(result.error ?? `Failed to ${action} commission calculation.`);
  }

  function handleMarkPayable() {
    if (!expenseAccountId || !payableAccountId) {
      setError('Select both a commission expense account and a commission payable account first.');
      return;
    }
    run('markPayable', () => markCommissionCalculationPayable(id, expenseAccountId, payableAccountId));
  }

  function handleMarkPaid() {
    if (!cashAccountId || !paymentReference.trim()) {
      setError('Select a cash account and enter a payment reference first.');
      return;
    }
    run('markPaid', () => markCommissionCalculationPaid(id, cashAccountId, paymentReference.trim()));
  }

  const reasonActions: { key: ActionKey; label: string; run: () => Promise<{ ok: boolean; error?: string }> }[] = [];
  if (status === 'CALCULATED' || status === 'PENDING') {
    reasonActions.push({ key: 'cancel', label: 'Cancel', run: () => cancelCommissionCalculation(id, reason.trim()) });
  }
  reasonActions.push({ key: 'reverse', label: status === 'PAID' ? 'Claw back' : 'Reverse', run: () => reverseCommissionCalculation(id, reason.trim()) });
  if (status === 'PENDING') {
    reasonActions.push({ key: 'reject', label: 'Reject', run: () => rejectCommissionCalculation(id, reason.trim()) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2) }}>
      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {status === 'CALCULATED' && (
          <Button type="button" variant="primary" disabled={pending !== null} onClick={() => run('submit', () => submitCommissionCalculation(id))}>
            {pending === 'submit' ? 'Submitting…' : 'Submit for approval'}
          </Button>
        )}
        {status === 'PENDING' && (
          <Button type="button" variant="primary" disabled={pending !== null} onClick={() => run('approve', () => approveCommissionCalculation(id))}>
            {pending === 'approve' ? 'Approving…' : 'Approve'}
          </Button>
        )}
        {status === 'APPROVED' && (
          <>
            <Select
              label="Expense account"
              value={expenseAccountId}
              onChange={(e) => setExpenseAccountId(e.target.value)}
              options={accountOptions}
              placeholder="Commission expense…"
              style={{ minWidth: '160px', fontSize: '12px' }}
            />
            <Select
              label="Payable account"
              value={payableAccountId}
              onChange={(e) => setPayableAccountId(e.target.value)}
              options={accountOptions}
              placeholder="Commission payable…"
              style={{ minWidth: '160px', fontSize: '12px' }}
            />
            <Button type="button" variant="primary" disabled={pending !== null} onClick={handleMarkPayable}>
              {pending === 'markPayable' ? 'Posting accrual…' : 'Mark payable'}
            </Button>
          </>
        )}
        {status === 'PAYABLE' && (
          <>
            <Select
              label="Cash account"
              value={cashAccountId}
              onChange={(e) => setCashAccountId(e.target.value)}
              options={accountOptions}
              placeholder="Cash / bank…"
              style={{ minWidth: '160px', fontSize: '12px' }}
            />
            <TextField label="Payment reference" placeholder="Payment reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} style={{ minWidth: '160px' }} />
            <Button type="button" variant="primary" disabled={pending !== null} onClick={handleMarkPaid}>
              {pending === 'markPaid' ? 'Posting payment…' : 'Mark paid'}
            </Button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField label="" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minWidth: '140px' }} />
        {reasonActions.map((a) => (
          <Button key={a.key} type="button" variant="secondary" disabled={pending !== null || !reason.trim()} onClick={() => run(a.key, a.run)}>
            {pending === a.key ? `${a.label}ing…` : a.label}
          </Button>
        ))}
      </div>

      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
