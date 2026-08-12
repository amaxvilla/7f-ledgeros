'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { changePassword } from './actions';

/**
 * Frontend Completion — Login History + Change Password. A plain
 * client-state form (not `ActionForm`) — same reasoning `EnrollMfaForm`
 * gives for its own step components: this needs to clear both password
 * fields and show a one-time success message after submit, state
 * `ActionForm`'s own fire-and-forget/`revalidatePath` contract has no
 * natural place for (there's nothing on this page that reflects
 * "password last changed" to revalidate toward).
 */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await changePassword(currentPassword, newPassword);

    setPending(false);
    if (result.ok) {
      setCurrentPassword('');
      setNewPassword('');
      setSuccess(true);
    } else {
      setError(result.error ?? 'Failed to change password.');
    }
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
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField
        label="Current password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="New password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        style={{ minWidth: '220px' }}
      />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Changing…' : 'Change password'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
        {success && <div style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Password changed.</div>}
      </div>
    </form>
  );
}
