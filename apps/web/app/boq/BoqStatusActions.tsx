'use client';

import { PmoStatusActions } from '@7f/ui';
import { advanceBoq } from './actions';

/**
 * Frontend Completion — thin wrapper over the shared `PmoStatusActions`
 * (`@7f/ui`), extracted once `WorkPackageStatusActions`,
 * `ProgressValuationStatusActions`, `CertificateStatusActions`, and
 * `VariationOrderStatusActions` had all independently reimplemented the
 * exact same `WORKFLOW_ORDER`-advance-or-reject shape this file (PMO.1)
 * originally introduced — a fifth-consumer signal repeatedly flagged
 * across every one of those checkpoints' own doc comments, per the
 * master prompt's own "prefer reusable components... do not duplicate
 * UI components" instruction. This wrapper's own public interface
 * (`<BoqStatusActions id={...} status={...} />`) is unchanged — every
 * existing call site elsewhere in this app needed no changes.
 *
 * `buttonFontSize="12px"` preserves this component's own original size
 * exactly (confirmed via direct diff against all four siblings before
 * this refactor — Boq/WorkPackage/ProgressValuation were originally
 * `12px`, Certificate/VariationOrder were `11px`) — a pure refactor, so
 * nothing renders any differently than it did before this extraction.
 */
export function BoqStatusActions({ id, status }: { id: string; status: string }) {
  return (
    <PmoStatusActions
      status={status}
      buttonFontSize="12px"
      errorFallback="Failed to update BOQ status."
      onAdvance={(target) => advanceBoq(id, target)}
    />
  );
}
