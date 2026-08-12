'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { assessRisk, setRiskMitigationPlan, monitorRisk } from './actions';

const PROBABILITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const IMPACT_OPTIONS = PROBABILITY_OPTIONS;

/**
 * Frontend Completion, FE-1.6 — `assess`/`mitigation-plan`/`monitor`,
 * the workflow-progression trio FE-1.5's own report deliberately split
 * out of `RiskRowActions.tsx` as "a genuinely different-shaped
 * checkpoint" (two enum `Select`s, a text field, and a no-fields
 * button, versus `owner`/`convert-to-issue`'s own "meaningful at any
 * stage, no fields or one field" shape). See `actions.ts`'s own doc
 * comment for the full before-coding analysis, including the fresh
 * `RiskProbability`/`RiskImpact`/`RiskStatus` re-verification against
 * `schema.prisma` rather than trusted from FE-1.5's own report.
 *
 * Deliberately a NEW component, not a further expansion of
 * `RiskRowActions.tsx` — same "don't touch already-shipped, tested code
 * you don't have to" posture that component itself took against
 * `CloseRiskButton.tsx` one checkpoint ago, now applied a second time
 * for consistency. Rendered as a third, sibling component in the same
 * Actions cell.
 *
 * VISIBILITY: all three actions share `assertRiskOpen`'s own bare
 * `status !== 'CLOSED'` gate server-side, but this component adds one
 * further UX-level restriction beyond that: also hidden once
 * `OCCURRED`. Unlike `CLOSED`, the backend doesn't itself block any of
 * these three calls against an `OCCURRED` risk — but a risk marked
 * `OCCURRED` has already manifested (typically via `convert-to-issue`,
 * which sets exactly this status) and further prospective
 * assessment/mitigation-planning/monitoring of a risk that has already
 * happened reads as a stale, confusing offer rather than a genuine next
 * step. Renders `null` entirely for both `OCCURRED` and `CLOSED` — no
 * dash, the same convention `RiskRowActions.tsx` already established
 * (`CloseRiskButton` owns the one dash this cell needs).
 *
 * Within the remaining four open-and-not-yet-occurred statuses
 * (`IDENTIFIED`/`ASSESSED`/`MITIGATING`/`MONITORING`), all three actions
 * stay visible and enabled throughout — no per-action status gating
 * beyond the shared `OCCURRED`/`CLOSED` hide above. Re-assessing,
 * revising a mitigation plan, or (re-)starting monitoring are all
 * legitimate at any of those four stages (see `actions.ts`'s own doc
 * comment on `setRiskMitigationPlan` specifically, the one action whose
 * server-side effect is a genuine status move rather than an in-place
 * update) — deliberately NOT hiding "Start monitoring" once already
 * `MONITORING`, since re-invoking it is a harmless no-op (`monitorRisk`
 * unconditionally sets `MONITORING` again), not a silent regression the
 * way Issues' own `start`-after-`OPEN` was.
 *
 * `TextField`'s own default `id` is label-derived, not row-unique — the
 * same duplicate-`id`-across-`DataTable`-rows bug `RiskRowActions.tsx`
 * and `IssueRowActions.tsx` both already caught and fixed. Fixed here
 * the same way, for both the mitigation-plan `TextField` and (since
 * `Select` shares the same underlying pattern) both `Select`s.
 *
 * ADDENDUM (Mobile Responsiveness, row-action touch-target rollout,
 * Project Issues/Risks batch) — all three `Button` usages in this file
 * (Assess, Set plan, Start monitoring) had their own pre-FE-10.14
 * compact override removed, same reasoning as `RiskRowActions.tsx`'s
 * own ADDENDUM in this same directory. At the time, this file's own two
 * `Select` overrides and one `TextField` override were deliberately left
 * unchanged, `Button`-only scoping for that rollout.
 *
 * ADDENDUM (Mobile Responsiveness, `TextField`/`Select` population) —
 * those three deferred overrides (Probability `Select`, Impact
 * `Select`, Mitigation-plan `TextField`) are removed now (`minWidth`
 * preserved on each). No missing-`id` fix needed alongside any of the
 * three — confirmed directly, all three already had their own
 * row-unique `id` from this file's very first version (see above), the
 * pure style-only shape, not the combined fix `SnagActions.tsx` needed
 * one checkpoint prior.
 */
export function RiskWorkflowActions({ id, status }: { id: string; status: string }) {
  const [probability, setProbability] = React.useState('');
  const [impact, setImpact] = React.useState('');
  const [assessPending, setAssessPending] = React.useState(false);
  const [assessError, setAssessError] = React.useState<string | null>(null);

  const [mitigationPlan, setMitigationPlan] = React.useState('');
  const [planPending, setPlanPending] = React.useState(false);
  const [planError, setPlanError] = React.useState<string | null>(null);

  const [monitorPending, setMonitorPending] = React.useState(false);
  const [monitorError, setMonitorError] = React.useState<string | null>(null);

  async function handleAssess(e: React.FormEvent) {
    e.preventDefault();
    setAssessPending(true);
    setAssessError(null);
    const result = await assessRisk(id, { probability, impact });
    setAssessPending(false);
    if (result.ok) {
      setProbability('');
      setImpact('');
    } else {
      setAssessError(result.error ?? 'Failed to assess risk.');
    }
  }

  async function handleSetPlan(e: React.FormEvent) {
    e.preventDefault();
    setPlanPending(true);
    setPlanError(null);
    const result = await setRiskMitigationPlan(id, mitigationPlan);
    setPlanPending(false);
    if (result.ok) {
      setMitigationPlan('');
    } else {
      setPlanError(result.error ?? 'Failed to set mitigation plan.');
    }
  }

  async function handleMonitor() {
    setMonitorPending(true);
    setMonitorError(null);
    const result = await monitorRisk(id);
    setMonitorPending(false);
    if (!result.ok) setMonitorError(result.error ?? 'Failed to start monitoring risk.');
  }

  if (status === 'OCCURRED' || status === 'CLOSED') {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <form onSubmit={handleAssess} style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <Select
          label="Probability"
          id={`assess-probability-${id}`}
          value={probability}
          onChange={(e) => setProbability(e.target.value)}
          options={PROBABILITY_OPTIONS}
          placeholder="…"
          required
          style={{ minWidth: '100px' }}
        />
        <Select
          label="Impact"
          id={`assess-impact-${id}`}
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          options={IMPACT_OPTIONS}
          placeholder="…"
          required
          style={{ minWidth: '100px' }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={assessPending}
        >
          {assessPending ? 'Assessing…' : 'Assess'}
        </Button>
      </form>
      {assessError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{assessError}</span>}

      <form onSubmit={handleSetPlan} style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <TextField
          label="Mitigation plan"
          id={`mitigation-plan-${id}`}
          value={mitigationPlan}
          onChange={(e) => setMitigationPlan(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={planPending}
        >
          {planPending ? 'Saving…' : 'Set plan'}
        </Button>
      </form>
      {planError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{planError}</span>}

      <Button
        type="button"
        variant="secondary"
        disabled={monitorPending}
        onClick={handleMonitor}
      >
        {monitorPending ? 'Starting…' : 'Start monitoring'}
      </Button>
      {monitorError && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{monitorError}</span>}
    </div>
  );
}
