'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { updateAgent } from '../actions';

const AGENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'BROKER', label: 'Broker' },
];

const WHT_OPTIONS: SelectOption[] = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
];

export interface AgentFormValues {
  agentType: 'INDIVIDUAL' | 'COMPANY' | 'BROKER';
  displayName: string;
  contactPersonName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  licenseNumber: string;
  licenseIssuingBody: string;
  licenseExpiryDate: string;
  registrationNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankSwiftCode: string;
  taxIdentificationNumber: string;
  withholdingTaxExempt: boolean;
  agreementReference: string;
  agreementStartDate: string;
  agreementEndDate: string;
  notes: string;
}

/**
 * A "settings" form, not a "new entry" one — mirrors
 * `EditEntityForm.tsx`'s own posture: pre-filled from the agent's
 * current values, does NOT reset after a successful save. Same field
 * set `UpdateAgentDto` has (confirmed directly — `code`/`entityId`/
 * `status` are all deliberately absent there, same three excluded
 * here: `code`/`entityId` are treated as immutable identity, `status`
 * only moves through `AgentLifecycleActions`'s own guarded endpoints,
 * never through this general update).
 */
export function EditAgentForm({ agentId, initialValues }: { agentId: string; initialValues: AgentFormValues }) {
  const [values, setValues] = React.useState(initialValues);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  function set<K extends keyof AgentFormValues>(key: K, value: AgentFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await updateAgent(agentId, {
      agentType: values.agentType,
      displayName: values.displayName,
      contactPersonName: values.contactPersonName || undefined,
      email: values.email,
      phone: values.phone,
      addressLine1: values.addressLine1 || undefined,
      addressLine2: values.addressLine2 || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      country: values.country || undefined,
      licenseNumber: values.licenseNumber || undefined,
      licenseIssuingBody: values.licenseIssuingBody || undefined,
      licenseExpiryDate: values.licenseExpiryDate || undefined,
      registrationNumber: values.registrationNumber || undefined,
      bankName: values.bankName || undefined,
      bankAccountName: values.bankAccountName || undefined,
      bankAccountNumber: values.bankAccountNumber || undefined,
      bankSwiftCode: values.bankSwiftCode || undefined,
      taxIdentificationNumber: values.taxIdentificationNumber || undefined,
      withholdingTaxExempt: values.withholdingTaxExempt,
      agreementReference: values.agreementReference || undefined,
      agreementStartDate: values.agreementStartDate || undefined,
      agreementEndDate: values.agreementEndDate || undefined,
      notes: values.notes || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to update agent.');
      return;
    }
    setSuccess(true);
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
      <Select label="Agent type" value={values.agentType} onChange={(e) => set('agentType', e.target.value as AgentFormValues['agentType'])} options={AGENT_TYPE_OPTIONS} style={{ minWidth: '150px' }} />
      <TextField label="Display name" value={values.displayName} onChange={(e) => set('displayName', e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Contact person (optional)" value={values.contactPersonName} onChange={(e) => set('contactPersonName', e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Email" type="email" value={values.email} onChange={(e) => set('email', e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Phone" value={values.phone} onChange={(e) => set('phone', e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="Address line 1 (optional)" value={values.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="City (optional)" value={values.city} onChange={(e) => set('city', e.target.value)} style={{ minWidth: '140px' }} />
      <TextField label="State (optional)" value={values.state} onChange={(e) => set('state', e.target.value)} style={{ minWidth: '140px' }} />
      <TextField label="Country (optional)" value={values.country} onChange={(e) => set('country', e.target.value)} style={{ minWidth: '140px' }} />
      <TextField label="License number (optional)" value={values.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="License issuing body (optional)" value={values.licenseIssuingBody} onChange={(e) => set('licenseIssuingBody', e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="License expiry (optional)" type="date" value={values.licenseExpiryDate} onChange={(e) => set('licenseExpiryDate', e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="Registration number (optional)" value={values.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Bank name (optional)" value={values.bankName} onChange={(e) => set('bankName', e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="Bank account name (optional)" value={values.bankAccountName} onChange={(e) => set('bankAccountName', e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Bank account number (optional)" value={values.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Bank SWIFT code (optional)" value={values.bankSwiftCode} onChange={(e) => set('bankSwiftCode', e.target.value)} style={{ minWidth: '140px' }} />
      <TextField label="Tax ID (optional)" value={values.taxIdentificationNumber} onChange={(e) => set('taxIdentificationNumber', e.target.value)} style={{ minWidth: '160px' }} />
      <Select label="WHT exempt" value={String(values.withholdingTaxExempt)} onChange={(e) => set('withholdingTaxExempt', e.target.value === 'true')} options={WHT_OPTIONS} style={{ minWidth: '110px' }} />
      <TextField label="Agreement reference (optional)" value={values.agreementReference} onChange={(e) => set('agreementReference', e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Agreement start (optional)" type="date" value={values.agreementStartDate} onChange={(e) => set('agreementStartDate', e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="Agreement end (optional)" type="date" value={values.agreementEndDate} onChange={(e) => set('agreementEndDate', e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="Notes (optional)" value={values.notes} onChange={(e) => set('notes', e.target.value)} style={{ minWidth: '220px' }} />

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {success && !error && <div style={{ width: '100%', color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Saved.</div>}
    </form>
  );
}
