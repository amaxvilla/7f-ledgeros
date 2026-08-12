'use client';

import * as React from 'react';
import { Button, TextField, tokens, required, validateForm } from '@7f/ui';
import { createVendor } from './actions';

/**
 * Frontend Completion, FE-3.2 — no `entityId` prop, same as
 * `CreateTaxCodeForm`: `Vendor` has no `entityId` column (confirmed
 * against `schema.prisma`), so it's shared reference data across every
 * entity, same as `Account`/`TaxCode`.
 *
 * ADDENDUM (FE-10.6) — Validation, third form in this rollout (after
 * CreateLeadForm/CreateCustomerForm, FE-10.5, and CreateTenantForm,
 * this same checkpoint). Only `code`/`name` get a validator —
 * `taxId`/`bankName`/`bankAccountNumber` have no confirmed format this
 * codebase enforces anywhere else (unlike, say, `email`/`phone`'s own
 * well-known formats, or `customerId`/`unitId`'s confirmed UUID
 * columns on `CreateTenantForm`), so this checkpoint doesn't invent one
 * for them rather than guess at a business rule nothing else in this
 * app has established.
 */
export function CreateVendorForm() {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [taxId, setTaxId] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [bankAccountNumber, setBankAccountNumber] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateForm(
      { code, name },
      { code: [required('Code is required')], name: [required('Name is required')] },
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setPending(true);
    setError(null);

    const result = await createVendor({
      code,
      name,
      taxId: taxId || undefined,
      bankName: bankName || undefined,
      bankAccountNumber: bankAccountNumber || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create vendor.');
      return;
    }
    setCode('');
    setName('');
    setTaxId('');
    setBankName('');
    setBankAccountNumber('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
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
      <TextField
        label="Code"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setFieldErrors(({ code: _drop, ...rest }) => rest);
        }}
        required
        error={fieldErrors.code}
        style={{ minWidth: '120px' }}
      />
      <TextField
        label="Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setFieldErrors(({ name: _drop, ...rest }) => rest);
        }}
        required
        error={fieldErrors.name}
        style={{ minWidth: '200px' }}
      />
      <TextField label="Tax ID (optional)" value={taxId} onChange={(e) => setTaxId(e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="Bank name (optional)" value={bankName} onChange={(e) => setBankName(e.target.value)} style={{ minWidth: '180px' }} />
      <TextField
        label="Bank account number (optional)"
        value={bankAccountNumber}
        onChange={(e) => setBankAccountNumber(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add vendor'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
