'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { savePasswordPolicy } from './actions';

export interface PasswordPolicyValues {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  expiryDays: number | null;
  historyCount: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
}

/**
 * Frontend Completion, Security.3 — see `actions.ts`'s own doc comment
 * for the full before-coding analysis. Scoped to the GLOBAL policy only
 * (`entityId` never sent).
 *
 * A SETTINGS form, not a create-then-reset form — deliberately does
 * NOT clear its fields after a successful save, unlike every
 * `Create*Form` in this app. The same "state persists, doesn't reset"
 * posture `UserRolesForm.tsx`'s own checklist already established for
 * the same reason: this represents the CURRENT configuration, not a
 * blank slate for the next entry — clearing it after save would show
 * the admin an empty form for a policy that's actually still fully
 * configured.
 *
 * Boolean fields use plain `<input type="checkbox">`, the exact
 * convention `UserRolesForm.tsx`/`RolePermissionsForm.tsx` already
 * established (`@7f/ui` has no `Checkbox` component of its own,
 * confirmed directly against its `index.ts` exports) — not a `Select`
 * with Yes/No options, which would be a novel pattern for a boolean
 * this app has never actually used.
 *
 * `expiryDays` is the one nullable field (`null` = passwords never
 * expire, confirmed directly in `PasswordPolicyService.isExpired`) —
 * rendered as an optional numeric `TextField`; an empty value sends
 * `undefined`, which `actions.ts`'s own `savePasswordPolicy` — and the
 * DTO beneath it — both already treat as "leave unset."
 */
export function PasswordPolicyForm({ current }: { current: PasswordPolicyValues }) {
  const [minLength, setMinLength] = React.useState(String(current.minLength));
  const [requireUppercase, setRequireUppercase] = React.useState(current.requireUppercase);
  const [requireLowercase, setRequireLowercase] = React.useState(current.requireLowercase);
  const [requireNumber, setRequireNumber] = React.useState(current.requireNumber);
  const [requireSymbol, setRequireSymbol] = React.useState(current.requireSymbol);
  const [expiryDays, setExpiryDays] = React.useState(current.expiryDays === null ? '' : String(current.expiryDays));
  const [historyCount, setHistoryCount] = React.useState(String(current.historyCount));
  const [maxFailedLoginAttempts, setMaxFailedLoginAttempts] = React.useState(String(current.maxFailedLoginAttempts));
  const [lockoutDurationMinutes, setLockoutDurationMinutes] = React.useState(String(current.lockoutDurationMinutes));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await savePasswordPolicy({
      minLength: Number(minLength),
      requireUppercase,
      requireLowercase,
      requireNumber,
      requireSymbol,
      expiryDays: expiryDays === '' ? undefined : Number(expiryDays),
      historyCount: Number(historyCount),
      maxFailedLoginAttempts: Number(maxFailedLoginAttempts),
      lockoutDurationMinutes: Number(lockoutDurationMinutes),
    });

    setPending(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error ?? 'Failed to save password policy.');
    }
  }

  const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space(2),
    fontFamily: tokens.font.body,
    fontSize: '13px',
    color: tokens.color.textPrimary,
    cursor: 'pointer',
  };

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
        maxWidth: '520px',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
        <TextField
          label="Minimum length"
          type="number"
          value={minLength}
          onChange={(e) => setMinLength(e.target.value)}
          required
          style={{ minWidth: '140px' }}
        />
        <TextField
          label="Password history (reuse check)"
          type="number"
          value={historyCount}
          onChange={(e) => setHistoryCount(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
        <TextField
          label="Expiry (days, optional)"
          type="number"
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
          style={{ minWidth: '160px' }}
        />
        <TextField
          label="Max failed login attempts"
          type="number"
          value={maxFailedLoginAttempts}
          onChange={(e) => setMaxFailedLoginAttempts(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
        <TextField
          label="Lockout duration (minutes)"
          type="number"
          value={lockoutDurationMinutes}
          onChange={(e) => setLockoutDurationMinutes(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2) }}>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={requireUppercase} onChange={(e) => setRequireUppercase(e.target.checked)} />
          <span>Require an uppercase letter</span>
        </label>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={requireLowercase} onChange={(e) => setRequireLowercase(e.target.checked)} />
          <span>Require a lowercase letter</span>
        </label>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={requireNumber} onChange={(e) => setRequireNumber(e.target.checked)} />
          <span>Require a number</span>
        </label>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={requireSymbol} onChange={(e) => setRequireSymbol(e.target.checked)} />
          <span>Require a symbol</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save password policy'}
        </Button>
        {saved && !error && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>Saved.</span>
        )}
        {error && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{error}</span>}
      </div>
    </form>
  );
}
