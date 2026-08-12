'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { upsertFeatureFlag } from './actions';

const ENABLED_OPTIONS = [
  { value: 'false', label: 'Disabled' },
  { value: 'true', label: 'Enabled' },
];

/**
 * Frontend Completion, FE-8.1 — new flags start `Disabled` by default
 * in this form (a deliberate, safer default for the "creating a
 * brand-new gate" case), unlike `FeatureFlagRow`'s own pre-populated
 * value for an existing one. Calls the SAME `upsertFeatureFlag` action
 * as `FeatureFlagRow` — see `actions.ts`'s own doc comment for why
 * there's only one action for both create and update.
 */
export function CreateFeatureFlagForm() {
  const [key, setKey] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [enabled, setEnabled] = React.useState('false');
  const [rolloutPercent, setRolloutPercent] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await upsertFeatureFlag(key, {
      enabled: enabled === 'true',
      description: description || undefined,
      rolloutPercent: rolloutPercent === '' ? undefined : Number(rolloutPercent),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create feature flag.');
      return;
    }
    setKey('');
    setDescription('');
    setEnabled('false');
    setRolloutPercent('');
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
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField label="Key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. billing.v2" required style={{ minWidth: '200px' }} />
      <TextField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ minWidth: '260px' }} />
      <Select label="Status" value={enabled} onChange={(e) => setEnabled(e.target.value)} options={ENABLED_OPTIONS} style={{ minWidth: '130px' }} />
      <TextField label="Rollout % (optional)" type="number" value={rolloutPercent} onChange={(e) => setRolloutPercent(e.target.value)} style={{ minWidth: '140px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add flag'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
