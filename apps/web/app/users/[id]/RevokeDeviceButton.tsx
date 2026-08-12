'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { revokeDevice } from './actions';

/**
 * Frontend Completion, Users.3 — the one per-row admin action on the
 * Devices table (`DELETE /security/devices/user/:userId/:deviceId`,
 * `TrustedDeviceService.revokeDeviceForUser`). Unlike Sessions
 * (admin-side is all-or-nothing — see `actions.ts`'s own doc comment),
 * Devices genuinely support single-device revocation for admins, so
 * this is a per-row button, not a page-level one the way
 * `SecurityAdminActions.tsx`'s Revoke All Sessions is.
 *
 * No confirm dialog — this app has no modal primitive anywhere, the
 * same constraint every other single-click destructive action in this
 * app (`CloseRiskButton`, `ResolveIssueButton`, `CancelCurrentForm`)
 * has already accepted rather than worked around.
 *
 * `listDevicesForUser` only ever returns non-revoked devices
 * (`where: { userId, revoked: false }`, confirmed directly) — so a
 * successful revoke always removes the row entirely on the next
 * `revalidatePath`-triggered reload, rather than needing this button to
 * show a "Revoked" terminal state the way `BoqStatusActions`'s own dash
 * does for `CERTIFIED`/`REJECTED`. Nothing to render here once the
 * action succeeds; the row itself is simply gone.
 *
 * ADDENDUM (FE-10.26, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. Batched with
 * `RevokeLinkedAccountButton.tsx` (Bank Integration) this checkpoint
 * for their shared "single revoke action, identical override shape"
 * fix, not directory adjacency — confirmed directly the two files do
 * NOT sit in the same directory before batching them. 22 of 25
 * originally-flagged files fixed now, 4 remaining.
 */
export function RevokeDeviceButton({ userId, deviceId }: { userId: string; deviceId: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRevoke() {
    setPending(true);
    setError(null);
    const result = await revokeDevice(userId, deviceId);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to revoke device.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleRevoke}
      >
        {pending ? 'Revoking…' : 'Revoke'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
