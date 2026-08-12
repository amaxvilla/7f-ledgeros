'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { unlockAccount, revokeAllSessions } from './actions';

/**
 * Frontend Completion, Users.3 — the two admin actions on this page
 * that aren't tied to a specific row in a table (Unlock Account acts on
 * the user as a whole; Revoke All Sessions acts on every session at
 * once — see `actions.ts`'s own doc comment for why admin session
 * revocation has no per-session equivalent). Bundled into one small
 * component the same way `IssueRowActions.tsx` bundled `assign`/
 * `start`/`escalate` — two related, simple admin actions, not three
 * separate single-button files.
 *
 * Unlock is gated on `locked` (this page's own already-computed
 * `isCurrentlyLocked(user.lockedUntil)`) — offering it when the account
 * isn't locked would just be a confusing no-op the backend would
 * silently accept anyway (`manualUnlock` doesn't check the account was
 * actually locked first, confirmed directly), the same "don't offer
 * what accomplishes nothing" posture this app's row-action components
 * have taken throughout. Revoke All Sessions has no such gate — always
 * offered, since a session can always exist even when the account
 * isn't locked. Its own success state shows the real
 * `revokedCount` `actions.ts`'s own `revokeAllSessions` now surfaces
 * ("3 sessions revoked."), not a bare "Done."
 */
export function SecurityAdminActions({ userId, locked }: { userId: string; locked: boolean }) {
  const [reason, setReason] = React.useState('');
  const [unlockPending, setUnlockPending] = React.useState(false);
  const [unlockError, setUnlockError] = React.useState<string | null>(null);

  const [revokePending, setRevokePending] = React.useState(false);
  const [revokeError, setRevokeError] = React.useState<string | null>(null);
  const [revokeCount, setRevokeCount] = React.useState<number | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockPending(true);
    setUnlockError(null);
    const result = await unlockAccount(userId, reason || undefined);
    setUnlockPending(false);
    if (result.ok) {
      setReason('');
    } else {
      setUnlockError(result.error ?? 'Failed to unlock account.');
    }
  }

  async function handleRevokeAll() {
    setRevokePending(true);
    setRevokeError(null);
    setRevokeCount(null);
    const result = await revokeAllSessions(userId);
    setRevokePending(false);
    if (result.ok) {
      setRevokeCount(result.revokedCount ?? 0);
    } else {
      setRevokeError(result.error ?? 'Failed to revoke sessions.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(4), marginBottom: tokens.space(6) }}>
      {locked && (
        <form onSubmit={handleUnlock} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
          <TextField
            label="Unlock reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ minWidth: '260px' }}
          />
          <Button type="submit" disabled={unlockPending}>
            {unlockPending ? 'Unlocking…' : 'Unlock account'}
          </Button>
          {unlockError && (
            <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{unlockError}</div>
          )}
        </form>
      )}

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="button" variant="secondary" disabled={revokePending} onClick={handleRevokeAll}>
          {revokePending ? 'Revoking…' : 'Revoke all sessions'}
        </Button>
        {revokeCount !== null && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
            {revokeCount} session{revokeCount === 1 ? '' : 's'} revoked.
          </span>
        )}
        {revokeError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{revokeError}</div>
        )}
      </div>
    </div>
  );
}
