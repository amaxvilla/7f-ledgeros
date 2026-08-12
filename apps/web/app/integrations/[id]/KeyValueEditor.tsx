'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';

export interface KeyValuePair {
  key: string;
  value: string;
}

/**
 * Frontend Completion, FE-7.2 — the JSON-editor primitive
 * `integrations/actions.ts`'s own FE-7.1 doc comment named as
 * deliberately deferred ("this app has no established JSON-textarea
 * input pattern anywhere yet... a real UX decision... deserves its own
 * considered checkpoint"). Built as a dynamic key/value row list
 * rather than a raw JSON textarea: `config`/`credentials` are both
 * flat `Record<string, unknown>` blobs in practice (every example in
 * `IntegrationProviderDriver`'s own comments — bucket name, region,
 * sender address, API key, client secret — is a flat string-keyed
 * map, never nested), so a row-per-key editor covers the real shape
 * without asking a non-technical admin to hand-write JSON syntax.
 *
 * Values are always edited as plain strings and coerced back with
 * `JSON.parse` on submit ONLY if the result would change the value's
 * type usefully (see the exported `pairsToObject` helper) — a number-
 * or boolean-looking value round-trips as one; anything else stays a
 * string. This is a deliberately simple heuristic, not a full JSON
 * value editor (arrays/nested objects aren't representable here) —
 * sufficient for the flat shape this domain actually has, not a
 * general-purpose JSON editor for every future use of `Record<string,
 * unknown>` in this app.
 *
 * ADDENDUM (verification pass): each row's `TextField`s originally
 * passed `label={index === 0 ? 'Key' : undefined}` — a real
 * `tsc --noEmit` error, since `TextFieldProps.label` is required
 * (`string`, confirmed directly against `Form.tsx`), not
 * `string | undefined`. Fixed by giving every row a real, unique label
 * (`Key (row N)`/`Value (row N)`) instead of trying to visually hide it
 * after the first row — the same per-row-unique-label shape every other
 * dynamic-line form in this app already uses (`CreateBudgetForm`'s
 * `Account (line N)`, `CreateBoqForm`'s `Item code (line N)`), and a
 * strict accessibility improvement over the original: every row's
 * inputs now have their own associated label rather than only the
 * first row being labeled at all.
 *
 * ADDENDUM (Mobile Responsiveness rollout) — both `Button` usages' own
 * compact `style` override removed (Remove/+ Add field), the same fix
 * this rollout applied to every other dynamic line-item form across
 * the app (`SubdividePlotsForm`, `CreateMasterPlanForm`, `CreateBoqForm`,
 * `CreateInstallmentScheduleForm`, `CreateARInvoiceForm`,
 * `CreateAPInvoiceForm`, `CreatePaymentVoucherForm`,
 * `ImportStatementForm`, `CreateWorkflowDefinitionForm`, and
 * `FeatureFlagRow`, confirmed directly each already carries its own
 * such addendum) — this file and `PublishDatasetForm.tsx` were the
 * last 2 of that population still unfixed, found by re-auditing the
 * originally-reported 12-file list directly rather than assuming it
 * was still fully outstanding (10 of the 12 had already been fixed
 * under checkpoints this repository's own `CHECKPOINT_REPORT.md` had
 * not yet caught up to writing up).
 */
export function pairsToObject(pairs: KeyValuePair[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const { key, value } of pairs) {
    if (!key.trim()) continue;
    if (value === 'true') result[key] = true;
    else if (value === 'false') result[key] = false;
    else if (value.trim() !== '' && !Number.isNaN(Number(value))) result[key] = Number(value);
    else result[key] = value;
  }
  return result;
}

export function objectToPairs(obj: Record<string, unknown> | null | undefined): KeyValuePair[] {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }));
}

export function KeyValueEditor({ pairs, onChange }: { pairs: KeyValuePair[]; onChange: (pairs: KeyValuePair[]) => void }) {
  function updatePair(index: number, field: 'key' | 'value', value: string) {
    onChange(pairs.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPair() {
    onChange([...pairs, { key: '', value: '' }]);
  }

  function removePair(index: number) {
    onChange(pairs.filter((_, i) => i !== index));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2) }}>
      {pairs.map((pair, index) => (
        <div key={index} style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end' }}>
          <TextField label={`Key (row ${index + 1})`} value={pair.key} onChange={(e) => updatePair(index, 'key', e.target.value)} style={{ minWidth: '160px' }} />
          <TextField label={`Value (row ${index + 1})`} value={pair.value} onChange={(e) => updatePair(index, 'value', e.target.value)} style={{ minWidth: '220px' }} />
          <Button type="button" variant="secondary" onClick={() => removePair(index)}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addPair} style={{ alignSelf: 'flex-start' }}>
        + Add field
      </Button>
    </div>
  );
}
