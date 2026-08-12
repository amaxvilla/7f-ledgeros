'use client';

import { PmoStatusActions } from '@7f/ui';
import { advanceProgressValuation } from './actions';

/**
 * Frontend Completion — thin wrapper over the shared `PmoStatusActions`
 * (`@7f/ui`); see `BoqStatusActions.tsx`'s own doc comment for the full
 * extraction rationale (this file was the third of the five consumers
 * that motivated it). Public interface unchanged. `buttonFontSize="12px"`
 * preserves this component's own original size exactly.
 */
export function ProgressValuationStatusActions({
  id,
  status,
  workPackageId,
}: {
  id: string;
  status: string;
  workPackageId: string;
}) {
  return (
    <PmoStatusActions
      status={status}
      buttonFontSize="12px"
      errorFallback="Failed to update progress valuation status."
      onAdvance={(target) => advanceProgressValuation(id, target, workPackageId)}
    />
  );
}
