'use client';

import * as React from 'react';
import { Button, TextField, tokens, useToast } from '@7f/ui';
import { flagOverdueCorrectiveActions } from './actions';

/**
 * Frontend Completion, FE-8.4 — see `actions.ts`'s own doc comment for
 * the full backend-shape reasoning. A single bulk-maintenance action,
 * not a `Create*Form` (nothing is created, no list to reset against)
 * and not a settings form either (there's no prior state to pre-fill —
 * `asOf` starts blank every time, since "the date I want to flag as of"
 * is a fresh choice on every run, not a persisted configuration value).
 * Shows the returned count in place after a successful run rather than
 * resetting the field, so the person can see what their last run did
 * before choosing whether to run it again with a different date.
 *
 * ADDENDUM (FE-10.1) — also calls `useToast()`'s own `showToast` on
 * both outcomes now, as this app's first real usage of the new toast
 * primitive (see `Toast.tsx`'s own doc comment for why this one
 * component, not a sweeping retrofit). The existing inline message
 * above is left exactly as it was — the toast is additive, not a
 * replacement; someone who's scrolled away from this form after
 * clicking submit still sees the outcome.
 */
export function FlagOverdueForm() {
  const { showToast } = useToast();
  const [asOf, setAsOf] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [flagged, setFlagged] = React.useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFlagged(null);

    const result = await flagOverdueCorrectiveActions(asOf);

    setPending(false);
    if (result.ok) {
      setFlagged(result.flagged ?? 0);
      showToast(`${result.flagged ?? 0} corrective action${result.flagged === 1 ? '' : 's'} flagged as overdue.`, 'positive');
    } else {
      setError(result.error ?? 'Failed to flag overdue corrective actions.');
      showToast(result.error ?? 'Failed to flag overdue corrective actions.', 'negative');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        padding: tokens.space(4),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField
        label="As of date"
        type="date"
        value={asOf}
        onChange={(e) => setAsOf(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Flagging…' : 'Flag overdue corrective actions'}
      </Button>
      {flagged !== null && !error && (
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>
          {flagged} corrective action{flagged === 1 ? '' : 's'} flagged as overdue.
        </span>
      )}
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
