'use client';

import { PmoStatusActions } from '@7f/ui';
import { advanceWorkPackage } from './actions';

/**
 * Frontend Completion — thin wrapper over the shared `PmoStatusActions`
 * (`@7f/ui`); see `BoqStatusActions.tsx`'s own doc comment for the full
 * extraction rationale (this file was itself the second of the five
 * consumers that motivated it). Public interface unchanged — every
 * existing call site needed no changes. `buttonFontSize="12px"`
 * preserves this component's own original size exactly.
 */
export function WorkPackageStatusActions({ id, status }: { id: string; status: string }) {
  return (
    <PmoStatusActions
      status={status}
      buttonFontSize="12px"
      errorFallback="Failed to update work package status."
      onAdvance={(target) => advanceWorkPackage(id, target)}
    />
  );
}
