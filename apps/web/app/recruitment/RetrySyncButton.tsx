'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { retryCalendarSync, retryTeamsSync, retryContactSync, retrySignatureSync } from './actions';

type SyncKind = 'calendar' | 'teams' | 'contact' | 'signature';

const RETRY_FN: Record<SyncKind, (id: string) => Promise<{ ok: boolean; error?: string }>> = {
  calendar: retryCalendarSync,
  teams: retryTeamsSync,
  contact: retryContactSync,
  signature: retrySignatureSync,
};

/**
 * Frontend Completion — Recruitment "needs attention" sync-failures
 * panel, HSE.7's own recommended follow-up (re-checking `DashboardController`
 * turned up four already-built, already-wired list endpoints —
 * `recruitment-calendar-sync-failures`/`-contact-sync-failures`/
 * `-teams-sync-failures`/`-signature-sync-failures` — with no frontend
 * consumer anywhere, each explicitly documented server-side as one half
 * of the same widget). **Investigated further and found a better fit
 * than the `DashboardController` wrappers this checkpoint went looking
 * for**: `InterviewController`/`CandidateController`/`OfferController`
 * each already expose the identical underlying query directly on their
 * own domain routes (`recruitment/interviews/calendar-sync/failures`,
 * `/teams-sync/failures`, `recruitment/candidates/contact-sync/failures`,
 * `recruitment/offers/signature-sync/failures`) — the same routes this
 * page's own existing fetches already prefer (`/recruitment/...`,
 * never `/dashboard/...`) — so those are what `page.tsx` calls, not the
 * `DashboardController` duplicates.
 *
 * One shared button, not four near-identical components — a genuine
 * fourth-real-consumer case (`JournalEntryStatusActions.tsx`'s own
 * `run(action, fn)` parameter shape already established that accepting
 * a bound `(id) => Promise<...>` function is idiomatic here; this
 * component takes a `kind` discriminant instead, since all four retry
 * actions share an identical `(id: string)` signature and this button
 * itself — unlike `JournalEntryStatusActions` — never needs to show
 * more than one of them at once per row).
 *
 * No hide-once-resolved logic: a successful retry clears the row's own
 * `*SyncFailedAt` server-side, so `revalidatePath('/recruitment')`
 * naturally drops it from the next render's list — this component
 * doesn't need to guess at that. A REPEAT failure is a real, confirmed
 * possibility (`retryCalendarSync`/`retryTeamsSync`/`retrySignatureSync`
 * each throw `ConflictException` on a second consecutive failure,
 * confirmed directly), surfaced the same generic way every other
 * action's server-side error already is in this app — the row simply
 * stays present with its own error shown, not specially guarded
 * against.
 *
 * ADDENDUM (FE-10.23, Mobile Responsiveness rollout) — the one `Button`
 * usage's own compact `style` override removed; now renders at
 * `Button`'s own properly-sized default touch target, same fix this
 * rollout has now applied across 16 of 25 originally-flagged files. A
 * 1+3+3 split with `VacancyActions.tsx`/`RequisitionActions.tsx` (their
 * own sibling ADDENDUMs) — the first three-file batch in this rollout's
 * own history, and yet another distinct per-file count, continuing to
 * confirm this rollout's standing point that counts aren't uniform and
 * are worth checking directly each time.
 */
export function RetrySyncButton({ id, kind }: { id: string; kind: SyncKind }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRetry() {
    setPending(true);
    setError(null);
    const result = await RETRY_FN[kind](id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Retry failed.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleRetry}
      >
        {pending ? 'Retrying…' : 'Retry'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
