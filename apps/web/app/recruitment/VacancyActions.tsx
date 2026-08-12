'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { publishVacancy, closeVacancy } from './actions';

/**
 * Frontend Completion — the first row-level status-transition control
 * in this app. Every `Create*Form` so far (including this same page's
 * own `CreateVacancyForm`) adds a new record; this instead mutates an
 * existing one, rendered per-row inside the vacancies `DataTable`'s new
 * "Actions" column (see `page.tsx`) rather than as a page-level form.
 *
 * BUTTON VISIBILITY IS A UI-LEVEL DECISION, NOT A BACKEND-ENFORCED ONE:
 * `publishVacancy` (recruitment.service.ts) throws `ConflictException`
 * outside DRAFT/ON_HOLD, so hiding "Publish" for OPEN/CLOSED/FILLED
 * here just avoids a click that the backend would reject anyway.
 * `closeVacancy` has no such backend guard at all — it accepts any
 * status — but closing a vacancy that was never opened (DRAFT) is not
 * a real workflow, so "Close" is likewise hidden outside OPEN/ON_HOLD.
 * If that read of the intended workflow turns out wrong, it's a
 * one-line change to this component's own `canPublish`/`canClose`
 * checks, not a backend change.
 *
 * "Close" offers two outcomes, both required by `closeVacancy`'s own
 * required `filled` argument (recruitment.controller.ts's `filled`
 * query param) — "Mark filled" and "Close (unfilled)" are two buttons
 * rather than one button plus a follow-up confirm dialog, since this
 * app has no modal/dialog primitive yet and the choice is a single
 * boolean, not worth inventing one for.
 *
 * Deliberately local to this one row, not lifted into `page.tsx` or a
 * shared component — this is the first control of its kind, so it's
 * too early to guess what a reusable "row action group" primitive
 * should look like across other pages that don't have one yet.
 *
 * ADDENDUM (FE-10.23, Mobile Responsiveness rollout) — all three
 * `Button` usages' own compact `style` override removed; each now
 * renders at `Button`'s own properly-sized default touch target. A
 * 1+3+3 split with `RetrySyncButton.tsx`/`RequisitionActions.tsx`
 * (their own sibling ADDENDUMs).
 */
export function VacancyActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState<'publish' | 'filled' | 'closed' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canPublish = status === 'DRAFT' || status === 'ON_HOLD';
  const canClose = status === 'OPEN' || status === 'ON_HOLD';

  async function handlePublish() {
    setPending('publish');
    setError(null);
    const result = await publishVacancy(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to publish vacancy.');
  }

  async function handleClose(filled: boolean) {
    setPending(filled ? 'filled' : 'closed');
    setError(null);
    const result = await closeVacancy(id, filled);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to close vacancy.');
  }

  if (!canPublish && !canClose) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        {canPublish && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={handlePublish}
          >
            {pending === 'publish' ? 'Publishing…' : 'Publish'}
          </Button>
        )}
        {canClose && (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={pending !== null}
              onClick={() => handleClose(true)}
            >
              {pending === 'filled' ? 'Saving…' : 'Mark filled'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending !== null}
              onClick={() => handleClose(false)}
            >
              {pending === 'closed' ? 'Closing…' : 'Close'}
            </Button>
          </>
        )}
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
