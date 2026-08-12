'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createRole } from './actions';

/**
 * Frontend Completion, FE-6 — same manual pending/error `useState` +
 * 'use client' form / 'use server' action split every create form in
 * this app already uses (see `CreateIpRuleForm`'s own doc comment for
 * the shared shape). No `entityId` prop — `Role` is system-wide, same
 * "no EntitySelector, not entity-scoped" posture `/security` and
 * `CreateIpRuleForm` both already establish for a different kind of
 * shared, non-entity-scoped resource.
 */
export function CreateRoleForm() {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createRole({
      code,
      name,
      description: description || undefined,
    });

    setPending(false);
    if (result.ok) {
      setCode('');
      setName('');
      setDescription('');
    } else {
      setError(result.error ?? 'Failed to create role.');
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
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ minWidth: '260px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create role'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
