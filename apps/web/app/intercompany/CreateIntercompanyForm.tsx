'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createIntercompany } from './actions';

export function CreateIntercompanyForm({ entities }: { entities: any[] }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  const entityOptions = entities.map(e => ({ value: e.id, label: e.name }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    try {
      await createIntercompany(
        fd.get('initiatorEntityId') as string,
        fd.get('counterpartyEntityId') as string,
        fd.get('initiatorAccountCode') as string,
        fd.get('counterpartyAccountCode') as string,
        Number(fd.get('amount')),
        fd.get('currency') as string,
        fd.get('description') as string
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
      <h3 style={{ marginBottom: tokens.space(4), fontSize: 16, fontWeight: 600 }}>New Transaction</h3>
      {error && <div style={{ color: tokens.color.negative, marginBottom: tokens.space(4) }}>{error}</div>}
      <div style={{ display: 'flex', gap: tokens.space(4), marginBottom: tokens.space(4), flexWrap: 'wrap' }}>
        <Select name="initiatorEntityId" label="Initiator" options={entityOptions} required />
        <Select name="counterpartyEntityId" label="Counterparty" options={entityOptions} required />
        <TextField name="initiatorAccountCode" label="Initiator Account" required />
        <TextField name="counterpartyAccountCode" label="Counterparty Account" required />
        <TextField name="amount" label="Amount" type="number" required />
        <TextField name="currency" label="Currency" required defaultValue="NGN" />
        <TextField name="description" label="Description" required />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Record Transaction'}</Button>
    </form>
  );
}
