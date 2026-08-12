'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { submitRequisition, refreshRequisitionApproval, closeRequisition } from './actions';

/**
 * Frontend Completion — the requisition-side counterpart to
 * `VacancyActions.tsx` (see that component's own doc comment for the
 * shared reasoning: UI-level button visibility, a plain dash for
 * nothing-to-do rows, local-only scope). Same shape, three buttons
 * instead of up to three, mapped to `recruitment.controller.ts`'s own
 * `submit`/`refresh-approval`/`close` endpoints.
 *
 * BUTTON VISIBILITY:
 * - "Submit" only for `DRAFT` — `submitRequisitionForApproval`
 *   (recruitment.service.ts) throws `ConflictException` for any other
 *   status, same "don't offer a click the backend would reject" posture
 *   `VacancyActions`'s own "Publish" button already takes.
 * - "Refresh approval" only when `hasWorkflowInstance` is true — calling
 *   it before a workflow exists is meaningless (the service itself
 *   treats it as a no-op then, per its own doc comment in
 *   `actions.ts`), and once a requisition has resolved to
 *   `APPROVED`/`REJECTED` there's nothing left to refresh either, so
 *   it's further scoped to `PENDING_APPROVAL` — the one status where a
 *   workflow decision is actually still outstanding.
 * - "Close" for everything except the already-terminal `CLOSED` — unlike
 *   `closeVacancy`, `closeRequisition` has no backend status guard
 *   either, and unlike vacancies (where closing a never-opened DRAFT
 *   isn't a real workflow), abandoning a requisition at any
 *   pre-`CLOSED` stage — including DRAFT, before it's even submitted —
 *   is a reasonable real action (a hiring need that no longer exists),
 *   so this one is not narrowed further the way `VacancyActions`'s own
 *   "Close" is.
 *
 * ADDENDUM (FE-10.23, Mobile Responsiveness rollout) — all three
 * `Button` usages' own compact `style` override removed; each now
 * renders at `Button`'s own properly-sized default touch target. A
 * 1+3+3 split with `RetrySyncButton.tsx`/`VacancyActions.tsx` (their
 * own sibling ADDENDUMs).
 */
export function RequisitionActions({
  id,
  status,
  hasWorkflowInstance,
}: {
  id: string;
  status: string;
  hasWorkflowInstance: boolean;
}) {
  const [pending, setPending] = React.useState<'submit' | 'refresh' | 'close' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = status === 'DRAFT';
  const canRefresh = hasWorkflowInstance && status === 'PENDING_APPROVAL';
  const canClose = status !== 'CLOSED';

  async function handleSubmit() {
    setPending('submit');
    setError(null);
    const result = await submitRequisition(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to submit requisition.');
  }

  async function handleRefresh() {
    setPending('refresh');
    setError(null);
    const result = await refreshRequisitionApproval(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to refresh approval status.');
  }

  async function handleClose() {
    setPending('close');
    setError(null);
    const result = await closeRequisition(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to close requisition.');
  }

  if (!canSubmit && !canRefresh && !canClose) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        {canSubmit && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={handleSubmit}
          >
            {pending === 'submit' ? 'Submitting…' : 'Submit'}
          </Button>
        )}
        {canRefresh && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={handleRefresh}
          >
            {pending === 'refresh' ? 'Refreshing…' : 'Refresh approval'}
          </Button>
        )}
        {canClose && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={handleClose}
          >
            {pending === 'close' ? 'Closing…' : 'Close'}
          </Button>
        )}
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
