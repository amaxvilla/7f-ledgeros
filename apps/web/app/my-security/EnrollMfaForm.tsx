'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { beginMfaEnrollment, confirmMfaEnrollment } from './actions';

type Step = 'start' | 'verify' | 'recovery-codes' | 'already-enabled';

/**
 * Frontend Completion — MFA enrollment UI, the last of the three gaps
 * this page's own doc comment named as deliberately deferred (after
 * "revoke all other sessions"; device naming remains open, blocked on a
 * backend rename endpoint that doesn't exist yet — see this
 * checkpoint's own release report).
 *
 * Four-step client state machine (`start` → `verify` → `recovery-codes`,
 * plus a dead-end `already-enabled` step) in ONE component, same
 * "one component, conditional render per step" shape LoginForm already
 * established for its own two-step (password → MFA-code) flow — no new
 * pattern invented for this.
 *
 * RECOVERY CODES ARE NEVER PERSISTED CLIENT-SIDE BEYOND THIS
 * COMPONENT'S OWN REACT STATE: no localStorage, no cookie, nothing sent
 * back to any action once received — MfaService.confirmEnrollment's own
 * doc comment is explicit these are returned in plaintext exactly once
 * and only their hashes are stored server-side; holding them any longer
 * or anywhere more persistent than this render would undermine that
 * guarantee for no benefit (the user is expected to copy/save them
 * externally, the standard pattern this mirrors from every other
 * TOTP-app enrollment flow).
 */
export function EnrollMfaForm() {
  const [step, setStep] = React.useState<Step>('start');
  const [secret, setSecret] = React.useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState('');
  const [code, setCode] = React.useState('');
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleStart() {
    setPending(true);
    setError(null);

    const result = await beginMfaEnrollment();

    setPending(false);
    if (result.alreadyEnabled) {
      setStep('already-enabled');
      return;
    }
    if (!result.ok || !result.secret || !result.qrCodeDataUrl) {
      setError(result.error ?? 'Failed to start MFA enrollment.');
      return;
    }
    setSecret(result.secret);
    setQrCodeDataUrl(result.qrCodeDataUrl);
    setStep('verify');
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await confirmMfaEnrollment(code);

    setPending(false);
    if (!result.ok || !result.recoveryCodes) {
      setError(result.error ?? 'Invalid or expired code.');
      return;
    }
    setRecoveryCodes(result.recoveryCodes);
    setStep('recovery-codes');
  }

  if (step === 'already-enabled') {
    return <p style={mutedTextStyle}>Two-factor authentication is already enabled on your account.</p>;
  }

  if (step === 'recovery-codes') {
    return (
      <div style={cardStyle}>
        <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textPrimary, margin: 0 }}>
          Two-factor authentication is now enabled. Save these recovery codes somewhere safe — each can be used once if
          you lose access to your authenticator app, and they will not be shown again.
        </p>
        <ul style={{ fontFamily: tokens.font.mono, fontSize: '13px', color: tokens.color.textPrimary, margin: 0, paddingLeft: tokens.space(5) }}>
          {recoveryCodes.map((rc) => (
            <li key={rc}>{rc}</li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => setStep('start')} type="button">
          Done
        </Button>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <form onSubmit={handleVerify} style={cardStyle}>
        <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, margin: 0 }}>
          Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL from the backend, not a static/remote asset Next's Image optimizer would help with */}
        <img src={qrCodeDataUrl} alt="MFA enrollment QR code" width={180} height={180} />
        <p style={{ fontFamily: tokens.font.mono, fontSize: '12px', color: tokens.color.textMuted, margin: 0 }}>
          Can&apos;t scan? Enter this code manually: {secret}
        </p>
        <TextField
          label="Authentication code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
        />
        {error && <div style={errorStyle}>{error}</div>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Verifying…' : 'Verify and enable'}
        </Button>
      </form>
    );
  }

  return (
    <div style={cardStyle}>
      <p style={mutedTextStyle}>Add an extra layer of security to your account with an authenticator app.</p>
      {error && <div style={errorStyle}>{error}</div>}
      <Button onClick={handleStart} disabled={pending} type="button">
        {pending ? 'Starting…' : 'Enable two-factor authentication'}
      </Button>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space(3),
  alignItems: 'flex-start',
  padding: tokens.space(4),
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
};

const mutedTextStyle: React.CSSProperties = {
  fontFamily: tokens.font.body,
  fontSize: '13px',
  color: tokens.color.textMuted,
  margin: 0,
};

const errorStyle: React.CSSProperties = {
  color: tokens.color.negative,
  fontFamily: tokens.font.body,
  fontSize: '13px',
};
