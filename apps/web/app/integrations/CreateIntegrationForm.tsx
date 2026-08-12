'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createIntegrationProvider } from './actions';

const CATEGORY_OPTIONS = [
  { value: 'MICROSOFT_GRAPH', label: 'Microsoft Graph' },
  { value: 'GOOGLE_WORKSPACE', label: 'Google Workspace' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'POWER_BI', label: 'Power BI' },
  { value: 'DIGITAL_SIGNATURE', label: 'Digital Signature' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'BANKING', label: 'Banking' },
  { value: 'API_GATEWAY', label: 'API Gateway' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Frontend Completion, FE-7.1. `providerCode` is a plain `TextField`,
 * not a `Select` — confirmed directly (`IntegrationProvider.providerCode`'s
 * own schema comment: "free text by design, see IntegrationProviderDriver")
 * this is intentionally open-ended, not a fixed enum like `category` is;
 * a `Select` here would fight the model rather than reflect it.
 *
 * `entityId` is optional (see `IntegrationProvider.entityId`'s own
 * schema comment — most integrations are configured once system-wide;
 * only some, like a bank integration tied to one legal entity, need
 * one). Left as a plain optional `TextField`, not `EntitySelector` —
 * this form creates providers that may deliberately have NO entity
 * scope at all, which `EntitySelector`'s own "enter an entity ID"
 * framing (built for pages that require one) doesn't fit.
 */
export function CreateIntegrationForm() {
  const [category, setCategory] = React.useState('MICROSOFT_GRAPH');
  const [providerCode, setProviderCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [entityId, setEntityId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createIntegrationProvider({
      category,
      providerCode,
      name,
      entityId: entityId || undefined,
    });

    setPending(false);
    if (result.ok) {
      setProviderCode('');
      setName('');
      setEntityId('');
    } else {
      setError(result.error ?? 'Failed to create integration.');
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
      <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORY_OPTIONS} style={{ minWidth: '200px' }} />
      <TextField label="Provider code" value={providerCode} onChange={(e) => setProviderCode(e.target.value)} required placeholder="e.g. TWILIO" style={{ minWidth: '160px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Entity ID (optional)" value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ minWidth: '200px' }} />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Add integration'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
