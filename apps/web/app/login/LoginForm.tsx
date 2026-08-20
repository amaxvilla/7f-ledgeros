'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, TextField, tokens } from '@7f/ui';
import { login, verifyMfa } from './actions';

/**
 * Frontend Completion, Checkpoint AI — see `actions.ts`'s own doc
 * comment for the full scoping rationale (why cookies aren't yet wired
 * into `fetchApi`).
 *
 * Follows every other form's established shape (manual pending/error
 * `useState`, `'use client'` + `'use server'` split) with one real
 * difference: there's no reset-on-success branch. Every other
 * `Create*Form` clears its own fields and stays on the same page after
 * a successful submit; `login()`/`verifyMfa()` redirect to `/` on
 * success instead (see their own doc comments), so from this
 * component's point of view a successful submit's promise never
 * actually resolves — the resolved branch below only ever runs on
 * failure (`result.ok === false`).
 *
 * No `entityId` prop — unlike every other form in this app, login
 * happens before any entity context exists.
 *
 * Checkpoint AP — `challengeToken` state is what switches this
 * component between its two phases: `null` renders the password step;
 * a non-null value (returned by `login()` when `mfaRequired`) renders
 * the code step instead, calling `verifyMfa()` with it. Kept as one
 * component with a conditional render rather than two separate ones —
 * unlike Create*Form's page-per-form split, these two steps share no
 * meaningful reuse with anything else and only ever appear in this
 * sequence, on this one page.
 *
 * Checkpoint AQ — the "remember this device" checkbox on the code step.
 * Plain `<input type="checkbox">`, not a design-system component — no
 * `Checkbox` exists in `@7f/ui` yet, same "style it inline rather than
 * invent a component mid-checkpoint" posture the "Back to log in"
 * plain `<button>` below already takes.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [challengeToken, setChallengeToken] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [rememberDevice, setRememberDevice] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await login({ email, password });

    setPending(false);

    if (result.mfaRequired && result.challengeToken) {
      setChallengeToken(result.challengeToken);
      return;
    }

    if (result.ok) {
      router.push('/');
      return;
    }

    setError(result.error ?? 'Login failed.');
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await verifyMfa({ challengeToken: challengeToken!, token: code, rememberDevice });

    setPending(false);

    if (result.ok) {
      router.push('/');
      return;
    }

    setError(result.error ?? 'Verification failed.');
  }

  if (challengeToken) {
    return (
      <form
        onSubmit={handleCodeSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space(3),
          padding: tokens.space(6),
          maxWidth: '360px',
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.md,
        }}
        aria-label="Verify your identity"
      >
        <p style={{ margin: 0, fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          Enter the 6-digit code from your authenticator app, or a recovery code.
        </p>
        <TextField
          label="Verification code"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space(2),
            fontFamily: tokens.font.body,
            fontSize: '13px',
            color: tokens.color.textMuted,
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
          Remember this device for 30 days
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? 'Verifying\u2026' : 'Verify'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setChallengeToken(null);
            setCode('');
            setRememberDevice(false);
            setError(null);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: tokens.color.textMuted,
            fontFamily: tokens.font.body,
            fontSize: '13px',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          Back to log in
        </button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </form>
    );
  }

  return (
    <form
      onSubmit={handlePasswordSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(3),
        padding: tokens.space(6),
        maxWidth: '360px',
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
      aria-label="Log in"
    >
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Logging in\u2026' : 'Log in'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
