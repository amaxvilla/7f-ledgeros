'use client';

import * as React from 'react';
import { Badge, Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { lookupPaymentVoucher, approvePaymentVoucher, postPaymentVoucher } from './actions';
import type { PaymentVoucherSummary } from './actions';

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'warning',
  POSTED: 'positive',
  CANCELLED: 'negative',
};

/**
 * Frontend Completion, AP.6 — Payment Voucher approve/post actions,
 * AP.5's own recommended next checkpoint. UNLIKE `PaymentBatchActions`
 * (which is blind-ID-entry only, since `AccountsPayableController` has
 * no read endpoint at all for batches), `GET /ap/payment-vouchers/:id`
 * DOES exist here (confirmed directly) — so this component follows
 * `StockBalanceLookup.tsx`'s own established "look up a single record
 * via a server action, then render it" shape instead: a real lookup
 * step first, then only the one action the voucher's own current
 * `status` actually permits, rather than always showing both an
 * Approve and a Post control the way `PaymentBatchActions` has to.
 *
 * `approvePaymentVoucher`/`postPaymentVoucher`'s own guards are still
 * NOT re-implemented client-side (`DRAFT`-only for approve, plus the
 * same maker-checker "preparer can't approve their own voucher" check
 * `approvePaymentBatch` already has; `APPROVED`-only for post) — this
 * component only uses the looked-up `status` to decide which control
 * to SHOW, not to pre-validate the click; the backend's own error is
 * still what's surfaced on failure, same posture as every other action
 * in this app.
 *
 * On a successful Approve or Post, this component re-runs the same
 * lookup rather than calling `revalidatePath` (there is no Server
 * Component fetch of this data to revalidate — the voucher's status
 * only exists in this component's own local state, populated by its
 * own prior lookup).
 */
export function PaymentVoucherActions({ accountOptions }: { accountOptions: SelectOption[] }) {
  const [voucherId, setVoucherId] = React.useState('');
  const [lookupPending, setLookupPending] = React.useState(false);
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [voucher, setVoucher] = React.useState<PaymentVoucherSummary | null>(null);

  const [approvePending, setApprovePending] = React.useState(false);
  const [approveError, setApproveError] = React.useState<string | null>(null);

  const [apControlAccountId, setApControlAccountId] = React.useState('');
  const [cashGlAccountId, setCashGlAccountId] = React.useState('');
  const [postPending, setPostPending] = React.useState(false);
  const [postError, setPostError] = React.useState<string | null>(null);

  async function runLookup(id: string) {
    setLookupPending(true);
    setLookupError(null);
    const result = await lookupPaymentVoucher(id);
    setLookupPending(false);
    if (!result.ok) {
      setLookupError(result.error ?? 'Failed to look up payment voucher.');
      setVoucher(null);
      return;
    }
    setVoucher(result.voucher ?? null);
    if (!result.voucher) setLookupError('No payment voucher found with that id.');
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    await runLookup(voucherId);
  }

  async function handleApprove() {
    setApprovePending(true);
    setApproveError(null);
    const result = await approvePaymentVoucher(voucherId);
    setApprovePending(false);
    if (!result.ok) {
      setApproveError(result.error ?? 'Failed to approve payment voucher.');
      return;
    }
    await runLookup(voucherId);
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!apControlAccountId || !cashGlAccountId) {
      setPostError('Select both an AP control account and a cash GL account first.');
      return;
    }
    setPostPending(true);
    setPostError(null);
    const result = await postPaymentVoucher(voucherId, apControlAccountId, cashGlAccountId);
    setPostPending(false);
    if (!result.ok) {
      setPostError(result.error ?? 'Failed to post payment voucher.');
      return;
    }
    await runLookup(voucherId);
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
      <form onSubmit={handleLookup} style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <TextField
          label="Voucher ID"
          value={voucherId}
          onChange={(e) => {
            setVoucherId(e.target.value);
            setVoucher(null);
            setApproveError(null);
            setPostError(null);
          }}
          placeholder="Paste a voucher id"
          style={{ maxWidth: '360px', fontFamily: tokens.font.mono }}
        />
        <Button type="submit" variant="secondary" disabled={!voucherId || lookupPending}>
          {lookupPending ? 'Looking up…' : 'Look up voucher'}
        </Button>
      </form>
      {lookupError && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{lookupError}</span>}

      {voucher && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
          <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center' }}>
            <span style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>{voucher.voucherNumber}</span>
            <Badge tone={STATUS_TONE[voucher.status] ?? 'neutral'}>{voucher.status}</Badge>
          </div>

          {voucher.status === 'DRAFT' && (
            <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
              <Button type="button" variant="secondary" disabled={approvePending} onClick={handleApprove}>
                {approvePending ? 'Approving…' : 'Approve voucher'}
              </Button>
              {approveError && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{approveError}</span>}
            </div>
          )}

          {voucher.status === 'APPROVED' && (
            <form onSubmit={handlePost} style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
              <Button type="submit" variant="secondary" disabled={postPending}>
                {postPending ? 'Posting…' : 'Post voucher'}
              </Button>
              {postError && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{postError}</span>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
