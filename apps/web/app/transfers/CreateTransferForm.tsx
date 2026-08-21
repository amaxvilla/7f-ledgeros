'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createBankTransfer } from './actions';

export function CreateTransferForm({ entities }: { entities: any[] }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  const entityOptions = entities.map(e => ({ value: e.id, label: e.name }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    try {
      await createBankTransfer(
        fd.get('providerCode') as string,
        fd.get('entityId') as string,
        fd.get('reference') as string,
        Number(fd.get('amount')),
        fd.get('currency') as string,
        fd.get('destinationBankCode') as string,
        fd.get('destinationAccountNumber') as string,
        fd.get('narration') as string
      );
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: tokens.space(8), padding: tokens.space(4), background: tokens.color.surface, border: '1px solid var(--ledgeros-border)', borderRadius: 8 }}>
      <h3 style={{ marginBottom: tokens.space(4), fontSize: 16, fontWeight: 600 }}>Create Transfer</h3>
      {error && <div style={{ color: tokens.color.negative, marginBottom: tokens.space(4) }}>{error}</div>}
      <div style={{ display: 'flex', gap: tokens.space(4), marginBottom: tokens.space(4), flexWrap: 'wrap' }}>
        <Select name="providerCode" label="Provider" options={[{value: 'MONO', label: 'Mono'}, {value: 'PAYSTACK', label: 'Paystack'}]} required />
        <Select name="entityId" label="Entity" options={entityOptions} required />
        <TextField name="reference" label="Reference (Unique)" required />
        <TextField name="amount" label="Amount" type="number" required />
        <TextField name="currency" label="Currency" defaultValue="NGN" required />
        <TextField name="destinationBankCode" label="Dest Bank Code" required />
        <TextField name="destinationAccountNumber" label="Dest Account" required />
        <TextField name="narration" label="Narration" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Create'}</Button>
    </form>
  );
}
