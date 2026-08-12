'use client';

import * as React from 'react';
import { Button } from './Form';
import { tokens } from '../tokens';

/**
 * `PmoService`'s own `WORKFLOW_ORDER` (confirmed directly against the
 * backend, not assumed) — every PMO document type that uses the shared
 * `advanceGeneric` helper (BOQ, Work Package, Progress Valuation,
 * Interim Payment Certificate, Variation Order) moves through this
 * exact same one-step-at-a-time sequence. `BoqStatusActions.tsx`'s own
 * original doc comment (PMO.1) first noted this as a shared constant
 * kept local "until a second real consumer justifies extracting it" —
 * this file IS that extraction, now that five consumers exist across
 * five separate PMO document pages, all confirmed identical by direct
 * diff rather than assumed from their shared doc-comment language alone.
 */
const WORKFLOW_ORDER = ['DRAFT', 'REVIEWED', 'APPROVED', 'CERTIFIED'];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  REVIEWED: 'Reviewed',
  APPROVED: 'Approved',
  CERTIFIED: 'Certified',
};

export interface PmoStatusActionsProps {
  status: string;
  /**
   * Called with the one-step-forward target status and which of the
   * two buttons triggered it. Each PMO document type's own backend
   * action has a different signature after its own bound id (some take
   * just `target`, others also need `workPackageId`) — that binding is
   * the caller's job, not this component's; every one of the five
   * current wrappers (`BoqStatusActions`, `WorkPackageStatusActions`,
   * `ProgressValuationStatusActions`, `CertificateStatusActions`,
   * `VariationOrderStatusActions`) is now a thin closure over its own
   * already-bound Server Action, passed in here as `onAdvance`.
   */
  onAdvance: (target: string, kind: 'advance' | 'reject') => Promise<{ ok: boolean; error?: string }>;
  /**
   * Shown when `onAdvance` resolves `{ ok: false }` with no `error`
   * message of its own — each PMO document type had its own generic
   * fallback string ("Failed to update BOQ status.", "...certificate
   * status.", etc.); preserved per-caller rather than replaced with one
   * generic message, so this is a required prop, not a default.
   */
  errorFallback: string;
  /**
   * The five original components split 3-vs-2 on button font size
   * (`BoqStatusActions`/`WorkPackageStatusActions`/
   * `ProgressValuationStatusActions` at `12px`, `CertificateStatusActions`/
   * `VariationOrderStatusActions` at `11px`) — confirmed directly via
   * grep across all five, not assumed to be identical from their
   * near-identical doc comments alone. Preserved exactly as a prop
   * rather than normalized to one value, since this is a pure
   * refactor — a visual change wasn't part of its scope, so each
   * wrapper passes its own original value and nothing renders any
   * differently than before this extraction.
   */
  buttonFontSize?: string;
}

/**
 * Two buttons ("Advance to `<next status>`" / "Reject"), a shared
 * pending state between them, an inline error, and a dash for the two
 * terminal cases (`CERTIFIED` — the end of `WORKFLOW_ORDER` — and
 * `REJECTED`, which isn't a member of `WORKFLOW_ORDER` at all, so
 * `WORKFLOW_ORDER.indexOf('REJECTED') === -1` falls through to the same
 * dash). Every one of this component's five original, independent
 * copies had this identical behavior — confirmed by diffing all five
 * against each other directly before writing this file, not assumed
 * from their doc comments' own claims of similarity.
 */
export function PmoStatusActions({ status, onAdvance, errorFallback, buttonFontSize = '12px' }: PmoStatusActionsProps) {
  const [pending, setPending] = React.useState<'advance' | 'reject' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const currentIndex = WORKFLOW_ORDER.indexOf(status);
  const nextStatus = currentIndex >= 0 ? WORKFLOW_ORDER[currentIndex + 1] : undefined;

  async function handleAdvance(target: string, kind: 'advance' | 'reject') {
    setPending(kind);
    setError(null);
    const result = await onAdvance(target, kind);
    setPending(null);
    if (!result.ok) setError(result.error ?? errorFallback);
  }

  if (status === 'CERTIFIED' || status === 'REJECTED' || !nextStatus) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: buttonFontSize, color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        <Button
          type="button"
          variant="primary"
          disabled={pending !== null}
          onClick={() => handleAdvance(nextStatus, 'advance')}
          style={{ padding: `${tokens.space(1)} ${tokens.space(2)}`, fontSize: buttonFontSize }}
        >
          {pending === 'advance' ? 'Advancing…' : `Advance to ${STATUS_LABEL[nextStatus] ?? nextStatus}`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={() => handleAdvance('REJECTED', 'reject')}
          style={{ padding: `${tokens.space(1)} ${tokens.space(2)}`, fontSize: buttonFontSize }}
        >
          {pending === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
