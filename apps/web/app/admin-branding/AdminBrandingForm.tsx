'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { updateEntityProfile } from './actions';

export function AdminBrandingForm({ entities, selectedEntityId, initialProfile }: { entities: any[], selectedEntityId: string, initialProfile: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  const entityOptions = entities.map(e => ({ value: e.id, label: e.name }));

  function handleEntityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('entityId', e.target.value);
    router.push('?' + params.toString());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    try {
      await updateEntityProfile(
        selectedEntityId,
        fd.get('primaryColor') as string,
        fd.get('secondaryColor') as string
      );
      alert('Saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ padding: tokens.space(4), background: tokens.color.surface, border: '1px solid var(--ledgeros-border)', borderRadius: 8 }}>
      <div style={{ marginBottom: tokens.space(6) }}>
        <Select name="entitySelect" label="Select Entity to Brand" options={entityOptions} value={selectedEntityId} onChange={handleEntityChange} />
      </div>

      <form onSubmit={handleSubmit}>
        <h3 style={{ marginBottom: tokens.space(4), fontSize: 16, fontWeight: 600 }}>Brand Profile</h3>
        {error && <div style={{ color: tokens.color.negative, marginBottom: tokens.space(4) }}>{error}</div>}
        <div style={{ display: 'flex', gap: tokens.space(4), marginBottom: tokens.space(4), flexWrap: 'wrap' }}>
          <TextField name="primaryColor" label="Primary Color (Hex)" defaultValue={initialProfile?.themePrimaryColor || ''} />
          <TextField name="secondaryColor" label="Secondary Color (Hex)" defaultValue={initialProfile?.themeSecondaryColor || ''} />
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save Profile'}</Button>
      </form>
    </div>
  );
}
