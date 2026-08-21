'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createDirectoryUser } from './actions';

export function CreateWorkspaceUserForm({ providerCode }: { providerCode: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    try {
      await createDirectoryUser(
        providerCode,
        fd.get('email') as string,
        fd.get('firstName') as string,
        fd.get('lastName') as string
      );
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: tokens.space(8), padding: tokens.space(4), background: tokens.color.surface, border: '1px solid var(--ledgeros-border)', borderRadius: 8 }}>
      <h3 style={{ marginBottom: tokens.space(4), fontSize: 16, fontWeight: 600 }}>Provision New User ({providerCode})</h3>
      {error && <div style={{ color: tokens.color.negative, marginBottom: tokens.space(4) }}>{error}</div>}
      <div style={{ display: 'flex', gap: tokens.space(4), marginBottom: tokens.space(4), flexWrap: 'wrap' }}>
        <TextField name="email" label="Email" type="email" required />
        <TextField name="firstName" label="First Name" required />
        <TextField name="lastName" label="Last Name" required />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Provision User'}</Button>
    </form>
  );
}
