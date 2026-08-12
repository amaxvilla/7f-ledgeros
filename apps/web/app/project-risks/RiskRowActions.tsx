'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { assignRiskOwner, convertRiskToIssue } from './actions';

/**
 * Frontend Completion, FE-1.5 — `owner`/`convert-to-issue`, two of the
 * five row actions `page.tsx`'s own doc comment named as deliberately
 * left for a follow-on checkpoint (`IssueController` — the
 * `convertRiskToIssue` link itself — was the other named item, closed
 * out by FE-1.4). `assess`/`mitigation-plan`/`monitor` remain deferred
 * — a genuinely separate, workflow-progression-shaped trio (see
 * `page.tsx`'s own ADDENDUM below for why they don't belong in this
 * checkpoint), not bundled in here just because they share the same
 * controller.
 *
 * Deliberately a NEW component, not an expansion of `CloseRiskButton.tsx`
 * — that file is already shipped and tested, and this session has no
 * working `node_modules`/network access to re-run its suite after a
 * change (the exact same "never replace working code you can't
 * re-verify" posture `IssueRowActions.tsx`'s own doc comment already
 * took against `ResolveIssueButton.tsx` one checkpoint ago). Rendered
 * as a second, sibling component in the same Actions cell, not a merge.
 *
 * Both actions share `closeRisk`'s own `assertRiskOpen` guard
 * (`CLOSED` only) — confirmed directly, no separate transition table.
 * Both hidden once `CLOSED`, the same "don't offer what the backend
 * would just reject" posture every row-action component in this app
 * already takes; renders `null` entirely in that case (not a dash) —
 * `CloseRiskButton` already renders its own dash in that same cell, a
 * second one would be redundant, the same reasoning
 * `IssueRowActions.tsx`'s own null-return already established.
 *
 * `convertRiskToIssue` is a single button with no fields — see
 * `actions.ts`'s own doc comment for why (every `ConvertRiskToIssueDto`
 * field is optional and the backend already fills sensible defaults
 * from the risk itself). No confirm dialog either: this app has no
 * modal primitive anywhere, the same constraint `ResolveIssueButton.tsx`
 * and `IssueRowActions.tsx`'s own Assign button both already accepted.
 *
 * `TextField`'s own default `id` is label-derived, not row-unique — the
 * same duplicate-`id`-across-`DataTable`-rows bug `IssueRowActions.tsx`
 * found and fixed for Issues' own Assign field. Fixed here the same
 * way: an explicit `id={`assign-owner-${id}`}`.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Project Issues/Risks batch) — both `Button` usages in this file
 * (Assign owner, Convert to issue) had their own pre-FE-10.14 compact
 * override removed, same reasoning as `IssueRowActions.tsx`'s own
 * ADDENDUM.
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` override
 * population) — the Assign-owner `TextField`'s own identical override
 * is now ALSO removed (`minWidth` preserved), same shape as
 * `IssueRowActions.tsx`'s own identical fix — this field already had
 * its own row-unique `id`, so no missing-`id` gap to close alongside
 * it here.
 */
export function RiskRowActions({ id, status }: { id: string; status: string }) {
  const [ownerId, setOwnerId] = React.useState('');
  const [assignPending, setAssignPending] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);

  const [convertPending, setConvertPending] = React.useState(false);
  const [convertError, setConvertError] = React.useState<string | null>(null);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignPending(true);
    setAssignError(null);
    const result = await assignRiskOwner(id, ownerId);
    setAssignPending(false);
    if (result.ok) {
      setOwnerId('');
    } else {
      setAssignError(result.error ?? 'Failed to assign risk owner.');
    }
  }

  async function handleConvert() {
    setConvertPending(true);
    setConvertError(null);
    const result = await convertRiskToIssue(id);
    setConvertPending(false);
    if (!result.ok) setConvertError(result.error ?? 'Failed to convert risk to issue.');
  }

  if (status === 'CLOSED') {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <form onSubmit={handleAssign} style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <TextField
          label="Assign owner (user id)"
          id={`assign-owner-${id}`}
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          required
          style={{ minWidth: '140px' }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={assignPending}
        >
          {assignPending ? 'Assigning…' : 'Assign owner'}
        </Button>
      </form>
      {assignError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{assignError}</span>}

      <Button
        type="button"
        variant="secondary"
        disabled={convertPending}
        onClick={handleConvert}
      >
        {convertPending ? 'Converting…' : 'Convert to issue'}
      </Button>
      {convertError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{convertError}</span>}
    </div>
  );
}
