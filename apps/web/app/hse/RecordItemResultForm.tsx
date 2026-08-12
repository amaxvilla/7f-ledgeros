'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { recordItemResult } from './actions';

/**
 * Frontend Completion, HSE.6 — see `actions.ts`'s own doc comment for
 * the full before-coding analysis. One instance per checklist item, not
 * a page-level form — a genuinely new UI shape for this app (a small
 * inline form nested inside a `DataTable` cell, since `DataTable` itself
 * has no row-expansion concept of its own, confirmed directly), unlike
 * every other `*Actions.tsx` component here which is a single no-fields
 * button.
 *
 * `isCompliant` is a real `Select` (`Compliant` / `Non-compliant`), not
 * a checkbox — `recordItemResult`'s own body (`{ isCompliant: boolean;
 * remarks?: string }`, confirmed directly against `HseController`) has
 * no third state, and a `Select` with an explicit placeholder avoids a
 * checkbox's own implicit-false-until-checked ambiguity for a field
 * that's genuinely binary but consequential (it feeds directly into
 * `finalizeChecklist`'s own derived PASS/FAIL/PASS_WITH_OBSERVATIONS
 * result). `remarks` is optional, a plain `TextField`.
 *
 * Once `isCompliant` is no longer `null` (already recorded, confirmed
 * directly this is exactly the piece of state `finalizeChecklist`'s own
 * "all items assessed" check reads), this renders a static compliant/
 * non-compliant summary instead of the form — re-submitting a result
 * has no dedicated "update" semantics on the backend (`recordItemResult`
 * would silently overwrite, confirmed directly), and no other write
 * path in this app re-opens an already-submitted action's own form, so
 * this doesn't invent one either.
 *
 * ADDENDUM (Mobile Responsiveness rollout) — the "Save" `Button`'s own
 * compact `style` override removed. This file was correctly identified
 * as still-unfixed by a fresh whole-app sweep rather than by trusting
 * `CHECKPOINT_REPORT.md`'s own top entry at face value — that report
 * was confirmed stale by up to four checkpoints (a sibling file in this
 * same batch, `GenerateCertificateForm.tsx`, already carried its own
 * "FE-10.33" addendum despite the report's own newest entry being
 * "FE-10.29"), so the report's "3 files remain" claim was re-verified
 * against the actual source rather than repeated — it was in fact only
 * 2, this file and `TaskActions.tsx`. `Select`/`TextField`'s own
 * `minWidth` overrides on this form are untouched — out of this
 * rollout's own `Button`-only scope, and not touch-target-related in
 * the first place.
 */
export function RecordItemResultForm({
  itemId,
  itemDescription,
  isCompliant,
  remarks,
}: {
  itemId: string;
  itemDescription: string;
  isCompliant: boolean | null;
  remarks: string | null;
}) {
  const [value, setValue] = React.useState('');
  const [remarksInput, setRemarksInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await recordItemResult(itemId, value === 'compliant', remarksInput || undefined);

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to record item result.');
    }
  }

  if (isCompliant !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), fontFamily: tokens.font.body, fontSize: '13px' }}>
        <span style={{ color: tokens.color.textPrimary }}>
          {itemDescription} — <strong style={{ color: isCompliant ? tokens.color.positive : tokens.color.negative }}>{isCompliant ? 'Compliant' : 'Non-compliant'}</strong>
        </span>
        {remarks && <span style={{ color: tokens.color.textMuted, fontSize: '12px' }}>{remarks}</span>}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(2), alignItems: 'flex-end', marginBottom: tokens.space(2) }}
    >
      <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textPrimary, minWidth: '160px' }}>{itemDescription}</span>
      <Select
        label="Result"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        options={[
          { value: 'compliant', label: 'Compliant' },
          { value: 'non-compliant', label: 'Non-compliant' },
        ]}
        placeholder="Assess…"
        required
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Remarks (optional)"
        value={remarksInput}
        onChange={(e) => setRemarksInput(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
      >
        {pending ? 'Saving…' : 'Save'}
      </Button>
      {error && <span style={{ width: '100%', fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </form>
  );
}
