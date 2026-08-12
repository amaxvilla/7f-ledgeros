'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createAgent } from './actions';

const AGENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'BROKER', label: 'Broker' },
];

const WHT_OPTIONS: SelectOption[] = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
];

/**
 * Mirrors `entities/CreateEntityForm.tsx`'s own shape for a
 * many-optional-field master-record form: required fields first, every
 * optional field labeled "(optional)" and left `undefined` when blank
 * rather than the form re-supplying a server-side default (see
 * `actions.ts`'s own doc comment). No `status` field — a new agent
 * always starts `PENDING_APPROVAL`, per `CreateAgentDto`.
 */
export function CreateAgentForm({ entityId }: { entityId: string }) {
  const [agentType, setAgentType] = React.useState<'INDIVIDUAL' | 'COMPANY' | 'BROKER'>('INDIVIDUAL');
  const [code, setCode] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [contactPersonName, setContactPersonName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [licenseNumber, setLicenseNumber] = React.useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [bankAccountName, setBankAccountName] = React.useState('');
  const [bankAccountNumber, setBankAccountNumber] = React.useState('');
  const [taxIdentificationNumber, setTaxIdentificationNumber] = React.useState('');
  const [withholdingTaxExempt, setWithholdingTaxExempt] = React.useState('false');
  const [agreementReference, setAgreementReference] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createAgent({
      entityId,
      agentType,
      code,
      displayName,
      contactPersonName: contactPersonName || undefined,
      email,
      phone,
      licenseNumber: licenseNumber || undefined,
      licenseExpiryDate: licenseExpiryDate || undefined,
      bankName: bankName || undefined,
      bankAccountName: bankAccountName || undefined,
      bankAccountNumber: bankAccountNumber || undefined,
      taxIdentificationNumber: taxIdentificationNumber || undefined,
      withholdingTaxExempt: withholdingTaxExempt === 'true',
      agreementReference: agreementReference || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create agent.');
      return;
    }
    setCode('');
    setDisplayName('');
    setContactPersonName('');
    setEmail('');
    setPhone('');
    setLicenseNumber('');
    setLicenseExpiryDate('');
    setBankName('');
    setBankAccountName('');
    setBankAccountNumber('');
    setTaxIdentificationNumber('');
    setWithholdingTaxExempt('false');
    setAgreementReference('');
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
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. AG-001" required style={{ minWidth: '120px' }} />
      <Select label="Agent type" value={agentType} onChange={(e) => setAgentType(e.target.value as typeof agentType)} options={AGENT_TYPE_OPTIONS} style={{ minWidth: '150px' }} />
      <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField
        label="Contact person (optional)"
        value={contactPersonName}
        onChange={(e) => setContactPersonName(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="License number (optional)" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="License expiry (optional)" type="date" value={licenseExpiryDate} onChange={(e) => setLicenseExpiryDate(e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="Bank name (optional)" value={bankName} onChange={(e) => setBankName(e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="Bank account name (optional)" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Bank account number (optional)" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Tax ID (optional)" value={taxIdentificationNumber} onChange={(e) => setTaxIdentificationNumber(e.target.value)} style={{ minWidth: '160px' }} />
      <Select label="WHT exempt" value={withholdingTaxExempt} onChange={(e) => setWithholdingTaxExempt(e.target.value)} options={WHT_OPTIONS} style={{ minWidth: '110px' }} />
      <TextField label="Agreement reference (optional)" value={agreementReference} onChange={(e) => setAgreementReference(e.target.value)} style={{ minWidth: '180px' }} />

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create agent'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
