'use client';

import { PmoStatusActions } from '@7f/ui';
import { advanceVariationOrder } from './actions';

/**
 * Frontend Completion — thin wrapper over the shared `PmoStatusActions`
 * (`@7f/ui`); see `BoqStatusActions.tsx`'s own doc comment for the full
 * extraction rationale (this file was the fifth consumer, the one whose
 * own checkpoint report first named this refactor as the clear next
 * standing recommendation). Public interface unchanged.
 * `buttonFontSize="11px"` preserves this component's own original size
 * exactly (matches `CertificateStatusActions`'s own original `11px`).
 */
export function VariationOrderStatusActions({
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
      buttonFontSize="11px"
      errorFallback="Failed to update variation order status."
      onAdvance={(target) => advanceVariationOrder(id, target, workPackageId)}
    />
  );
}
