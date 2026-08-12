'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { resolveIssue } from './actions';

/**
 * Frontend Completion — see `page.tsx`'s own doc comment for why
 * `resolve` (not `close`) is the one action this checkpoint surfaces:
 * `RiskIssueService.closeIssue` requires the issue already be
 * `RESOLVED` (confirmed directly), so it isn't a same-shape terminal
 * action the way `closeRisk` was for risks — `resolve` is.
 *
 * Hidden once already `RESOLVED` or `CLOSED` — `assertIssueOpen` itself
 * only blocks `CLOSED`, not `RESOLVED` (re-resolving a resolved issue
 * wouldn't error), but offering it again would be pointless, the same
 * "don't offer what accomplishes nothing" posture `VacancyActions`'s
 * own terminal-state dash already takes.
 *
 * Calls `resolveIssue(id)` with no `resolutionNotes` — `ResolveIssueDto`'s
 * only field is optional, and capturing free-text notes here would mean
 * either a second form or a modal this app has no primitive for yet
 * (same reasoning `VacancyActions`'s own doc comment gives for its
 * two-button "Mark filled"/"Close" split instead of a confirm dialog).
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Project Issues/Risks batch) — this file's own `Button` usage had its
 * pre-FE-10.14 compact override removed, same reasoning as
 * `IssueRowActions.tsx`'s own ADDENDUM in this same directory (which
 * chains back to `PlotReleaseActions.tsx`/`CloseBudgetButton.tsx`).
 */
export function ResolveIssueButton({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleResolve() {
    setPending(true);
    setError(null);
    const result = await resolveIssue(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to resolve issue.');
  }

  if (status === 'RESOLVED' || status === 'CLOSED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleResolve}
      >
        {pending ? 'Resolving…' : 'Resolve'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
