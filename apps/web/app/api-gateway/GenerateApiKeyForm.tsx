'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { generateApiKey } from './actions';

type Step = 'form' | 'reveal';

/**
 * Frontend Completion, Checkpoint AR — API Gateway's first write path,
 * and the tenth data-entry form in this app.
 *
 * Two-step client state machine (`form` → `reveal`), same shape
 * EnrollMfaForm's own doc comment describes for its own multi-step
 * flow, scaled down to two steps instead of four — there's no
 * equivalent of MFA's "scan a QR code" middle step, since the whole
 * point of `POST /api-gateway/keys` is that it returns the finished
 * key in one call, not a challenge to complete.
 *
 * PLAINTEXT KEY IS NEVER PERSISTED CLIENT-SIDE BEYOND THIS COMPONENT'S
 * OWN REACT STATE — no localStorage, no cookie, nothing sent back to
 * any action once received. Same reasoning EnrollMfaForm's own doc
 * comment gives for recovery codes: ApiKeyService.generateKey's own doc
 * comment is explicit this is returned in plaintext exactly once and
 * never stored anywhere retrievable server-side either (only keyHash
 * persists) — holding it any longer or anywhere more persistent than
 * this render would undermine that guarantee for no benefit. The user
 * is expected to copy it into whatever secret store their own
 * integration uses before dismissing this panel.
 *
 * `scopes` collects as one comma-separated TextField, split into an
 * array client-side before calling the action — GenerateApiKeyDto has
 * no closed set of valid scopes the way CreatePaymentLinkForm's
 * `providerCode` does (no ScopeRegistry equivalent exists in this
 * codebase to enumerate them from), so a free-text field is the honest
 * choice here rather than a Select with an invented, possibly-wrong
 * option list.
 */
export function GenerateApiKeyForm({ entityId }: { entityId: string }) {
  const [step, setStep] = React.useState<Step>('form');
  const [name, setName] = React.useState('');
  const [scopes, setScopes] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [rateLimitPerMinute, setRateLimitPerMinute] = React.useState('');
  const [plaintextKey, setPlaintextKey] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await generateApiKey({
      entityId,
      name,
      scopes: scopes.trim() ? scopes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      expiresAt: expiresAt || undefined,
      rateLimitPerMinute: rateLimitPerMinute ? Number(rateLimitPerMinute) : undefined,
    });

    setPending(false);
    if (!result.ok || !result.plaintextKey) {
      setError(result.error ?? 'Failed to generate API key.');
      return;
    }
    setPlaintextKey(result.plaintextKey);
    setStep('reveal');
  }

  function handleDone() {
    setName('');
    setScopes('');
    setExpiresAt('');
    setRateLimitPerMinute('');
    setPlaintextKey('');
    setStep('form');
  }

  if (step === 'reveal') {
    return (
      <div style={cardStyle}>
        <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textPrimary, margin: 0 }}>
          Copy this key now — it will not be shown again. Store it in your integration&apos;s own secret
          configuration, not in this app.
        </p>
        <code
          style={{
            fontFamily: tokens.font.mono,
            fontSize: '13px',
            color: tokens.color.textPrimary,
            background: tokens.color.surfaceRaised,
            padding: `${tokens.space(2)} ${tokens.space(3)}`,
            borderRadius: tokens.radius.sm,
            wordBreak: 'break-all',
          }}
        >
          {plaintextKey}
        </code>
        <Button variant="secondary" onClick={handleDone} type="button">
          Done
        </Button>
      </div>
    );
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
      aria-label={`Generate API key for entity ${entityId}`}
    >
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Partner integration — Acme Corp"
        required
        style={{ minWidth: '240px' }}
      />
      <TextField
        label="Scopes (comma-separated, optional)"
        value={scopes}
        onChange={(e) => setScopes(e.target.value)}
        placeholder="e.g. payments.read, invoices.read"
        style={{ minWidth: '260px' }}
      />
      <TextField
        label="Expires at (optional)"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Rate limit / min (optional)"
        type="number"
        min="1"
        value={rateLimitPerMinute}
        onChange={(e) => setRateLimitPerMinute(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Generating…' : 'Generate API key'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space(3),
  alignItems: 'flex-start',
  padding: tokens.space(4),
  marginBottom: tokens.space(6),
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
};
