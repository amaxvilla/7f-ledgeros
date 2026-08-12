'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { approvePaymentBatch, processPaymentBatch } from './actions';

/**
 * Frontend Completion, AP.4 — the second half of Payment Batches (see
 * `CreatePaymentBatchForm.tsx`/`actions.ts` for the create half and the
 * full scoping rationale). ID-entry driven, the same "no list/detail
 * read endpoint exists for this resource, so a picker or a register
 * table both need a GET this backend doesn't have" shape
 * `SessionSelector.tsx`/`EntitySelector.tsx`/the Workflow Instances
 * lookup form all already established elsewhere in this app for the
 * identical constraint — not a new pattern invented here.
 *
 * Approve needs only the pasted batch id; Process additionally needs
 * `apControlAccountId`/`cashGlAccountId` (`PostPaymentVoucherDto`,
 * confirmed directly — reuses `page.tsx`'s own already-fetched
 * `accountOptions`, the same `Select`-fed-by-Chart-of-Accounts shape
 * `PostAPInvoiceButton.tsx` already established, not a new fetch).
 * Both actions are exposed together, always, rather than only enabling
 * "Process" once "Approve" has succeeded in the SAME page session — this
 * component has no way to know a pasted batch's own current status
 * without the read endpoint that doesn't exist, so it can't gray out
 * the wrong one client-side; the backend's own `ConflictException` for
 * an out-of-sequence action (still `DRAFT`, or already `PROCESSED`) is
 * what actually enforces the real state machine, surfaced here as
 * whatever message it returns.
 *
 * Deliberately does NOT attempt `CreatePaymentVoucherDto` (creating the
 * individual vouchers a batch actually contains via its own
 * `allocations[]` array) — a separate, larger, nested-array form on the
 * scale of `CreateARInvoiceForm`'s own lines, named as real, unattempted
 * follow-on work, not silently out of scope.
 */
export function PaymentBatchActions({ accountOptions }: { accountOptions: SelectOption[] }) {
  const [batchId, setBatchId] = React.useState('');

  const [approvePending, setApprovePending] = React.useState(false);
  const [approveError, setApproveError] = React.useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = React.useState(false);

  const [apControlAccountId, setApControlAccountId] = React.useState('');
  const [cashGlAccountId, setCashGlAccountId] = React.useState('');
  const [processPending, setProcessPending] = React.useState(false);
  const [processError, setProcessError] = React.useState<string | null>(null);
  const [processSuccess, setProcessSuccess] = React.useState(false);

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    setApprovePending(true);
    setApproveError(null);
    setApproveSuccess(false);
    const result = await approvePaymentBatch(batchId);
    setApprovePending(false);
    if (result.ok) {
      setApproveSuccess(true);
    } else {
      setApproveError(result.error ?? 'Failed to approve payment batch.');
    }
  }

  async function handleProcess(e: React.FormEvent) {
    e.preventDefault();
    if (!apControlAccountId || !cashGlAccountId) {
      setProcessError('Select both an AP control account and a cash GL account first.');
      return;
    }
    setProcessPending(true);
    setProcessError(null);
    setProcessSuccess(false);
    const result = await processPaymentBatch(batchId, apControlAccountId, cashGlAccountId);
    setProcessPending(false);
    if (result.ok) {
      setProcessSuccess(true);
    } else {
      setProcessError(result.error ?? 'Failed to process payment batch.');
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(3),
        padding: tokens.space(4),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.space(8),
      }}
    >
      <TextField
        label="Batch ID"
        value={batchId}
        onChange={(e) => {
          setBatchId(e.target.value);
          setApproveSuccess(false);
          setProcessSuccess(false);
        }}
        placeholder="Paste a batch id from above"
        style={{ maxWidth: '360px', fontFamily: tokens.font.mono }}
      />

      <form onSubmit={handleApprove} style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="submit" variant="secondary" disabled={!batchId || approvePending}>
          {approvePending ? 'Approving…' : 'Approve batch'}
        </Button>
        {approveSuccess && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>Approved.</span>}
        {approveError && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{approveError}</span>}
      </form>

      <form onSubmit={handleProcess} style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Select
          label="AP control account"
          value={apControlAccountId}
          onChange={(e) => setApControlAccountId(e.target.value)}
          options={accountOptions}
          placeholder="Control account…"
          style={{ minWidth: '200px', fontSize: '13px' }}
        />
        <Select
          label="Cash / bank GL account"
          value={cashGlAccountId}
          onChange={(e) => setCashGlAccountId(e.target.value)}
          options={accountOptions}
          placeholder="Cash GL account…"
          style={{ minWidth: '200px', fontSize: '13px' }}
        />
        <Button type="submit" variant="secondary" disabled={!batchId || processPending}>
          {processPending ? 'Processing…' : 'Process batch'}
        </Button>
        {processSuccess && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>Processed.</span>}
        {processError && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{processError}</span>}
      </form>
    </div>
  );
}
