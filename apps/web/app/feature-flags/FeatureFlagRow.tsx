'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { upsertFeatureFlag } from './actions';

const ENABLED_OPTIONS = [
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
];

/**
 * Frontend Completion, FE-8.1 — pre-populated from the flag's own
 * current `enabled`/`description`/`rolloutPercent` (all returned as-is
 * by `GET /feature-flags`, confirmed directly — nothing on this model
 * is redacted the way `IntegrationProvider.encryptedCredentials` is).
 * `enabled` uses `Select`, same "no checkbox primitive yet" reasoning
 * every other boolean field in this app has used since
 * `CreateAccountForm`'s own doc comment first named it. Labels include
 * `flagKey` (e.g. "Status (billing.v2)") rather than a bare "Status" —
 * `TextField`/`Select` both derive their `id` from the label text when
 * none is passed explicitly (`Form.tsx`'s own fallback, confirmed
 * directly), and this component renders once per row in a table, so a
 * bare label would collide across rows into duplicate DOM ids.
 *
 * ADDENDUM (FE-10.32, Mobile Responsiveness rollout) — the Save
 * button's own compact `style` override removed, same fix this rollout
 * has now applied to every other undersized `Button` usage across the
 * app, including this one despite rendering inside a dense table row
 * (a smaller touch target is worse there, not better — the same
 * reasoning already applied to every per-row action button this
 * rollout has touched so far). Verified directly against this file's
 * own current source before fixing.
 */
export function FeatureFlagRow({
  flagKey,
  initialEnabled,
  initialDescription,
  initialRolloutPercent,
}: {
  flagKey: string;
  initialEnabled: boolean;
  initialDescription: string | null;
  initialRolloutPercent: number | null;
}) {
  const [enabled, setEnabled] = React.useState(String(initialEnabled));
  const [description, setDescription] = React.useState(initialDescription ?? '');
  const [rolloutPercent, setRolloutPercent] = React.useState(initialRolloutPercent === null ? '' : String(initialRolloutPercent));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSave() {
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await upsertFeatureFlag(flagKey, {
      enabled: enabled === 'true',
      description: description || undefined,
      rolloutPercent: rolloutPercent === '' ? undefined : Number(rolloutPercent),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save feature flag.');
      return;
    }
    setSuccess(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2), alignItems: 'flex-end', minWidth: '260px' }}>
      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end' }}>
        <Select label={`Status (${flagKey})`} value={enabled} onChange={(e) => setEnabled(e.target.value)} options={ENABLED_OPTIONS} style={{ minWidth: '110px' }} />
        <TextField label={`Description (${flagKey})`} value={description} onChange={(e) => setDescription(e.target.value)} style={{ minWidth: '180px' }} />
        <TextField label={`Rollout % (${flagKey})`} type="number" value={rolloutPercent} onChange={(e) => setRolloutPercent(e.target.value)} style={{ minWidth: '100px' }} />
        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
      {success && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.positive }}>Saved.</span>}
    </div>
  );
}
