'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { rotateCredentials } from './actions';
import { KeyValueEditor, pairsToObject } from './KeyValueEditor';
import type { KeyValuePair } from './KeyValueEditor';

/**
 * Frontend Completion, FE-7.2 — always starts with one empty row, never
 * pre-populated — see `actions.ts`'s own doc comment for why: the API
 * never returns existing credential values, only a `hasCredentials`
 * boolean, which `page.tsx` renders separately above this form so an
 * admin can tell whether they're setting credentials for the first
 * time or overwriting existing ones before they submit.
 */
export function RotateCredentialsForm({ id }: { id: string }) {
  const [pairs, setPairs] = React.useState<KeyValuePair[]>([{ key: '', value: '' }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await rotateCredentials(id, pairsToObject(pairs));

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to rotate credentials.');
      return;
    }
    setPairs([{ key: '', value: '' }]);
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
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <KeyValueEditor pairs={pairs} onChange={setPairs} />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Rotating…' : 'Rotate credentials'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
        {success && <div style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Credentials rotated.</div>}
      </div>
    </form>
  );
}
