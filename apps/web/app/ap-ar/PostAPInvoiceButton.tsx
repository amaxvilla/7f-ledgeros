'use client';

import * as React from 'react';
import { Button, Select, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { postAPInvoice } from './actions';

/**
 * Frontend Completion, AP.3 — the register's next row action after
 * AP.2, per that checkpoint's own recommendation. Confirmed directly
 * against `AccountsPayableService.postInvoice`: callable only from
 * `DRAFT` (same "hide for every non-actionable status" posture
 * `SubmitBudgetButton` already established for Budgeting), and it
 * throws a `BadRequestException` for any invoice with a
 * `purchaseOrderId` set ("PO-backed invoices post through Procurement
 * (three-way match), not the AP direct-posting endpoint") — a second,
 * genuinely different reason to hide the action, not just a duplicate
 * of the status check. `purchaseOrderId` isn't in `page.tsx`'s own
 * `APInvoice` interface yet even though Prisma's default `findMany`
 * already returns it on every row (confirmed against
 * `AccountsPayableService.listInvoices`'s own unscoped `include`) — see
 * `page.tsx`'s own doc-comment addendum for that one-field addition.
 *
 * Unlike `SubmitBudgetButton`/`CloseRiskButton`/`DeclineEnvelopeButton`
 * (all zero-argument actions), `postInvoice` needs a real argument —
 * `PostAPInvoiceDto.apControlAccountId` — so this is this app's first
 * row action built around a `Select` rather than a bare `Button`. No
 * new fetch: `accountOptions` (`GET /accounts/entity/:entityId/active`)
 * already exists on this page for `CreateAPInvoiceForm`'s own
 * `accountId` field, confirmed reusable here as `page.tsx`'s own doc
 * comment predicted before this checkpoint started. A client-side guard
 * blocks submission (and shows an inline error) if no account is
 * selected, rather than relying on the backend's own validation
 * round-trip for a mistake this page can catch immediately.
 *
 * ADDENDUM (Mobile Responsiveness rollout, ninth batch) — this file's
 * one `Button` usage (Post) had its own compact `style={{ padding,
 * fontSize }}` override, the same pre-FE-10.14 pattern this rollout has
 * been clearing file by file since FE-10.14. Removed — `Button` now
 * renders at its own properly-sized default touch target here too. The
 * `Select`'s own `minWidth`/`fontSize` override is untouched, same
 * `Button`-only scoping every prior batch has held to. Paired with
 * `PostARInvoiceButton.tsx` in the same batch — see that file's own
 * ADDENDUM (a 1+1 split, a fourth distinct shape from Issues' 3+1,
 * Risks' 2+3, and Budgeting's 1+2 — this rollout's own standing point
 * that per-file counts aren't uniform holds again here).
 */
export function PostAPInvoiceButton({
  id,
  status,
  purchaseOrderId,
  accountOptions,
}: {
  id: string;
  status: string;
  purchaseOrderId: string | null;
  accountOptions: SelectOption[];
}) {
  const [accountId, setAccountId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status !== 'DRAFT' || purchaseOrderId) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  async function handlePost() {
    if (!accountId) {
      setError('Select an AP control account first.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await postAPInvoice(id, accountId);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to post invoice.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end' }}>
        <Select
          label="AP control account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accountOptions}
          placeholder="Control account…"
          style={{ minWidth: '160px', fontSize: '12px' }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={handlePost}
        >
          {pending ? 'Posting…' : 'Post'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
