'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { cancelReservation, cancelAllocation } from './actions';

/**
 * Frontend Completion — one shared component for both Cancel actions
 * `page.tsx` can render (Cancel Reservation, Cancel Allocation) rather
 * than two near-duplicate files: both `CancelReservationDto` and
 * `CancelAllocationDto` are identically-shaped (`{ reason: string }`,
 * confirmed directly), and `page.tsx` only ever renders ONE of the two
 * `kind`s for a given unit at a time (gated on `unit.status`, mutually
 * exclusive) — so there's no case where this component needs to
 * distinguish the two beyond picking which Server Action to call.
 *
 * `unitId` is passed down as an explicit prop from `page.tsx` (which
 * already has it from its own route `params`) rather than read via a
 * client-side route-params hook — same "caller-supplied, not
 * independently fetched/read" discipline every other prop in this app
 * already follows, not a new pattern introduced just for this one
 * component. `unitId` is only needed for `revalidatePath` — the
 * mutation request itself only ever needs `targetId`.
 *
 * `reason` is REQUIRED on both DTOs (unlike `DeclineEnvelopeButton`'s
 * own optional one, confirmed directly — a real difference, not
 * copied blind) — reuses `RiskRowActions.tsx`'s own small inline-form
 * shape (`TextField` + submit `Button` in a `<form>`) rather than
 * `CloseRiskButton`'s own no-input button, since that shape has no
 * field to type a reason into at all.
 */
export function CancelCurrentForm({ unitId, kind, targetId }: { unitId: string; kind: 'reservation' | 'allocation'; targetId: string }) {
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result =
      kind === 'reservation' ? await cancelReservation(unitId, targetId, reason) : await cancelAllocation(unitId, targetId, reason);

    setPending(false);
    if (result.ok) {
      setReason('');
    } else {
      setError(result.error ?? `Failed to cancel ${kind}.`);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: tokens.space(3), alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required style={{ minWidth: '260px' }} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Cancelling…' : `Cancel ${kind}`}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
