'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { revokeLinkedAccount } from './actions';

/**
 * Frontend Completion — the revoke row action for a linked Mono
 * account, following `VacancyActions`/`RequisitionActions`'s own
 * established shape (manual pending/error useState, hide when there's
 * nothing to do) but simpler — a single action, not several, so no
 * per-action `pending` discriminant is needed the way those two
 * components' own `'publish' | 'filled' | 'closed'`-style state is.
 *
 * Hidden once already `REVOKED` — `MonoLinkedAccountService.revoke`
 * itself is idempotent for an already-revoked account (returns the
 * existing row rather than erroring), but offering the click again
 * would be pointless, the same "don't offer what accomplishes nothing"
 * posture `VacancyActions`'s own terminal-state dash already takes,
 * even though (unlike vacancies' own `closeVacancy`) the backend here
 * wouldn't actually reject it.
 *
 * ADDENDUM (FE-10.26, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target. Batched with
 * `RevokeDeviceButton.tsx` (Users) this checkpoint for their shared
 * "single revoke action, identical override shape" fix, not directory
 * adjacency — confirmed directly that the two do NOT sit in the same
 * directory (`bank-integration` vs. `users/[id]`), despite the similar
 * name, before batching them.
 */
export function RevokeLinkedAccountButton({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRevoke() {
    setPending(true);
    setError(null);
    const result = await revokeLinkedAccount(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to revoke linked account.');
  }

  if (status === 'REVOKED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
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
