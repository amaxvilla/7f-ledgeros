'use client';

import { PmoStatusActions } from '@7f/ui';
import { advanceCertificate } from './actions';

/**
 * Frontend Completion — thin wrapper over the shared `PmoStatusActions`
 * (`@7f/ui`); see `BoqStatusActions.tsx`'s own doc comment for the full
 * extraction rationale (this file was the fourth of the five consumers
 * that motivated it). Public interface unchanged. `buttonFontSize="11px"`
 * preserves this component's own original size exactly (this file was
 * originally `11px`, unlike Boq/WorkPackage/ProgressValuation's `12px`).
 *
 * Certifying a certificate (`target === 'CERTIFIED'`) also rolls its
 * retention into the work package's running `Retention` record
 * server-side (`PmoService.advanceCertificateStatus`) — entirely a
 * backend-side effect with nothing for this wrapper to reflect beyond
 * the certificate's own status badge updating via the normal
 * `revalidatePath` `advanceCertificate` already triggers.
 */
export function CertificateStatusActions({
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
      errorFallback="Failed to update certificate status."
      onAdvance={(target) => advanceCertificate(id, target, workPackageId)}
    />
  );
}
