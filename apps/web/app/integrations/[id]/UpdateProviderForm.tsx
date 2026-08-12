'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { updateProvider } from './actions';
import { KeyValueEditor, objectToPairs, pairsToObject } from './KeyValueEditor';
import type { KeyValuePair } from './KeyValueEditor';

const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

/**
 * Frontend Completion, FE-7.2 — pre-populated from the provider's own
 * current `name`/`isActive`/`retryMaxAttempts`/`retryBackoffMs`/
 * `config` (all returned as-is by `GET /integrations/:id` — only
 * `encryptedCredentials` is redacted, confirmed directly), unlike
 * `RotateCredentialsForm` below, which starts empty. `isActive` uses
 * `Select` with two string values (`'true'`/`'false'`) rather than a
 * checkbox — same "no checkbox primitive in `@7f/ui` yet" restraint
 * `CreateAccountForm`'s own doc comment gives, converted back to a real
 * boolean in `handleSubmit`.
 */
export function UpdateProviderForm({
  id,
  initialName,
  initialIsActive,
  initialRetryMaxAttempts,
  initialRetryBackoffMs,
  initialConfig,
}: {
  id: string;
  initialName: string;
  initialIsActive: boolean;
  initialRetryMaxAttempts: number;
  initialRetryBackoffMs: number;
  initialConfig: Record<string, unknown> | null;
}) {
  const [name, setName] = React.useState(initialName);
  const [isActive, setIsActive] = React.useState(String(initialIsActive));
  const [retryMaxAttempts, setRetryMaxAttempts] = React.useState(String(initialRetryMaxAttempts));
  const [retryBackoffMs, setRetryBackoffMs] = React.useState(String(initialRetryBackoffMs));
  const [configPairs, setConfigPairs] = React.useState<KeyValuePair[]>(objectToPairs(initialConfig));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await updateProvider(id, {
      name,
      isActive: isActive === 'true',
      retryMaxAttempts: Number(retryMaxAttempts),
      retryBackoffMs: Number(retryBackoffMs),
      config: pairsToObject(configPairs),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to update integration provider.');
      return;
    }
    setSuccess(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(4),
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
        <Select label="Status" value={isActive} onChange={(e) => setIsActive(e.target.value)} options={ACTIVE_OPTIONS} style={{ minWidth: '140px' }} />
        <TextField label="Retry max attempts" type="number" value={retryMaxAttempts} onChange={(e) => setRetryMaxAttempts(e.target.value)} style={{ minWidth: '160px' }} />
        <TextField label="Retry backoff (ms)" type="number" value={retryBackoffMs} onChange={(e) => setRetryBackoffMs(e.target.value)} style={{ minWidth: '160px' }} />
      </div>

      <div>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, display: 'block', marginBottom: tokens.space(2) }}>
          Config (non-secret settings)
        </span>
        <KeyValueEditor pairs={configPairs} onChange={setConfigPairs} />
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
        {success && <div style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Saved.</div>}
      </div>
    </form>
  );
}
