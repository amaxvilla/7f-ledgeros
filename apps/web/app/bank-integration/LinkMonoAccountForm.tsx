'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { linkMonoAccount } from './actions';

/**
 * Frontend Completion — Bank Integration's data-entry form, following
 * every `Create*Form`'s established pattern (manual pending/error
 * useState, 'use client' form + 'use server' action split,
 * reset-on-success). See `page.tsx`'s own doc comment for why
 * `bankAccountId` is a real `Select` here (bank accounts are already
 * fetched, entity-scoped, and genuinely enumerable) while `code` stays
 * a plain `TextField` (no Mono Connect widget exists yet to produce it
 * automatically).
 */
export function LinkMonoAccountForm({
  bankAccounts,
}: {
  bankAccounts: { id: string; accountName: string; bankName: string }[];
}) {
  const [bankAccountId, setBankAccountId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await linkMonoAccount({ bankAccountId, code });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to link account.');
      return;
    }
    setBankAccountId('');
    setCode('');
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
      <Select
        label="Bank account"
        value={bankAccountId}
        onChange={(e) => setBankAccountId(e.target.value)}
        options={bankAccounts.map((a) => ({ value: a.id, label: `${a.accountName} (${a.bankName})` }))}
        placeholder="Select a bank account…"
        required
        style={{ minWidth: '240px' }}
      />
      <TextField
        label="Mono Connect code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="one-time consent code"
        required
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Linking…' : 'Link account'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
