'use client';

import * as React from 'react';
import { Button, Select, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { postARInvoice } from './actions';

/**
 * Frontend Completion, AR.3 — the direct AR mirror of
 * `PostAPInvoiceButton`, confirmed NOT identical rather than
 * copy-pasted: `AccountsReceivableService.postInvoice` (read directly)
 * has only the one `status !== DRAFT` gate — no `purchaseOrderId`/
 * Procurement concept exists on the AR side at all, so this component
 * has no second hidden-condition branch the way `PostAPInvoiceButton`
 * does for PO-backed invoices. Same `Select`-plus-`Button` shape
 * otherwise (this app's second real consumer of that row-action
 * pattern, not yet worth extracting into a shared component — same
 * "simplest version first, let a second consumer justify extraction"
 * bar `Select`'s own doc comment sets, and a genuine third consumer
 * would need to exist before this one warrants it).
 *
 * Reuses `accountOptions` (`GET /accounts/entity/:entityId/active`,
 * already fetched on this page for both create forms) for
 * `arControlAccountId` — no new fetch, and no reason to prefer a
 * narrower "AR-only" account list here: `PostAPInvoiceButton` reuses
 * the same full active-accounts set for its own control account field,
 * and this backend has no separate AR-control-account-flagged subset to
 * filter down to.
 *
 * ADDENDUM (Mobile Responsiveness rollout, ninth batch) — this file's
 * one `Button` usage (Post) had its own compact `style={{ padding,
 * fontSize }}` override, the same pre-FE-10.14 pattern
 * `IssueRowActions.tsx`'s own ADDENDUM already named and every batch
 * since has been clearing file by file. Removed — `Button` now renders
 * at its own properly-sized default touch target here too. The
 * `Select`'s own `minWidth`/`fontSize` override is untouched — this
 * rollout is scoped to `Button` only, the same boundary every prior
 * batch has held to (see `PlotReleaseActions.tsx`'s own ADDENDUM for
 * the fullest statement of that scoping decision). Paired with
 * `PostAPInvoiceButton.tsx` in the same batch — see that file's own
 * ADDENDUM.
 */
export function PostARInvoiceButton({
  id,
  status,
  accountOptions,
}: {
  id: string;
  status: string;
  accountOptions: SelectOption[];
}) {
  const [accountId, setAccountId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status !== 'DRAFT') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  async function handlePost() {
    if (!accountId) {
      setError('Select an AR control account first.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await postARInvoice(id, accountId);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to post invoice.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end' }}>
        <Select
          label="AR control account"
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
