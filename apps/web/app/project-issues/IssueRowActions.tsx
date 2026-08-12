'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { assignIssue, startIssueWork, escalateIssue } from './actions';

/**
 * Frontend Completion, FE-1.4 — `assign`/`start`/`escalate`, the three
 * row actions `project-issues/page.tsx`'s own doc comment named as
 * deferred ("this page doesn't yet have room for" at the time it was
 * written). Deliberately a NEW, separate component rather than an
 * expansion of `ResolveIssueButton.tsx` — that file is already shipped
 * and tested (7 passing cases per this app's own checkpoint history),
 * and this session has no working `node_modules`/network access to
 * re-run its suite after a change (the same "never replace working
 * code without a way to verify the replacement" posture
 * `WorkPackageStatusActions.tsx`'s own doc comment already took against
 * `BoqStatusActions.tsx` in a different branch of this project's
 * history). Rendered as a second, sibling component in the same
 * Actions cell in `page.tsx`, not a merge.
 *
 * Hidden per-action based on `RiskIssueService`'s own real state, not a
 * client-side guess:
 * - **Assign**: visible for any non-`CLOSED` status — confirmed
 *   directly, `assertIssueOpen` (the one guard all three of
 *   `assign`/`start`/`escalate` share) only blocks `CLOSED`, and
 *   reassigning a `RESOLVED`/`ESCALATED`/`IN_PROGRESS` issue is a real,
 *   meaningful action (e.g. escalated issues still need an owner).
 *   Rendered as a compact inline `TextField` + `Button` pair, not a
 *   modal — this app has no modal primitive anywhere (same reasoning
 *   `ResolveIssueButton.tsx`'s own doc comment gives for skipping a
 *   notes modal on `resolve`).
 * - **Start work**: visible ONLY when status is `OPEN`. Server-side,
 *   calling this from `IN_PROGRESS`/`RESOLVED`/`ESCALATED` wouldn't
 *   error (`assertIssueOpen` only blocks `CLOSED`), but it would
 *   silently reset an already-further-along issue back to
 *   `IN_PROGRESS` — a real, surprising regression a client-side hide
 *   prevents, the same "don't offer what accomplishes nothing, or
 *   worse, undoes progress" posture `ResolveIssueButton.tsx`'s own
 *   hidden-when-`RESOLVED` condition already established one level up.
 * - **Escalate**: visible unless status is `CLOSED` or already
 *   `ESCALATED` — re-escalating an already-escalated issue is a
 *   no-op that accomplishes nothing, same reasoning as above.
 *
 * All three call their own `actions.ts` function with no shared
 * pending/error state — a user could plausibly submit an assign and
 * click escalate in close succession, and collapsing them into one
 * `pending` flag (the way `BoqStatusActions`'s own two-button "only one
 * in flight" design does for advance/reject, which really are mutually
 * exclusive) would incorrectly block that here.
 *
 * `TextField`'s own default `id` is derived from its `label` alone
 * (`field-${label...}`) — fine for a form rendered once per page, but
 * this component renders once per `DataTable` row, so every row would
 * otherwise share the same `id`/`htmlFor` pair, a real duplicate-id bug
 * (inconsistent label-click-to-focus behavior across rows, not just an
 * HTML-validity nitpick). Passed an explicit `id={`assign-to-${id}`}`
 * (the issue's own id) to keep every row's input uniquely addressable.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Project Issues/Risks batch) — all three `Button` usages in this file
 * (Assign, Start work, Escalate) had their own pre-FE-10.14 compact
 * override removed, same reasoning as `PlotReleaseActions.tsx`'s own
 * ADDENDUM (Land Bank batch), which points to `CloseBudgetButton.tsx`'s
 * own fuller reasoning.
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` override
 * population) — the "Assign to" `TextField`'s own identical override
 * is now ALSO removed (`minWidth` preserved), closing this file's own
 * remaining instance of the sibling population the `Button`-only fix
 * above didn't cover at the time.
 */
export function IssueRowActions({ id, status }: { id: string; status: string }) {
  const [assignedToId, setAssignedToId] = React.useState('');
  const [assignPending, setAssignPending] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);

  const [startPending, setStartPending] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);

  const [escalatePending, setEscalatePending] = React.useState(false);
  const [escalateError, setEscalateError] = React.useState<string | null>(null);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignPending(true);
    setAssignError(null);
    const result = await assignIssue(id, assignedToId);
    setAssignPending(false);
    if (result.ok) {
      setAssignedToId('');
    } else {
      setAssignError(result.error ?? 'Failed to assign issue.');
    }
  }

  async function handleStart() {
    setStartPending(true);
    setStartError(null);
    const result = await startIssueWork(id);
    setStartPending(false);
    if (!result.ok) setStartError(result.error ?? 'Failed to start work on this issue.');
  }

  async function handleEscalate() {
    setEscalatePending(true);
    setEscalateError(null);
    const result = await escalateIssue(id);
    setEscalatePending(false);
    if (!result.ok) setEscalateError(result.error ?? 'Failed to escalate issue.');
  }

  if (status === 'CLOSED') {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <form onSubmit={handleAssign} style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <TextField
          label="Assign to (user id)"
          id={`assign-to-${id}`}
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          required
          style={{ minWidth: '140px' }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={assignPending}
        >
          {assignPending ? 'Assigning…' : 'Assign'}
        </Button>
      </form>
      {assignError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{assignError}</span>}

      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        {status === 'OPEN' && (
          <Button
            type="button"
            variant="secondary"
            disabled={startPending}
            onClick={handleStart}
          >
            {startPending ? 'Starting…' : 'Start work'}
          </Button>
        )}
        {status !== 'ESCALATED' && (
          <Button
            type="button"
            variant="secondary"
            disabled={escalatePending}
            onClick={handleEscalate}
          >
            {escalatePending ? 'Escalating…' : 'Escalate'}
          </Button>
        )}
      </div>
      {startError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{startError}</span>}
      {escalateError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{escalateError}</span>}
    </div>
  );
}
