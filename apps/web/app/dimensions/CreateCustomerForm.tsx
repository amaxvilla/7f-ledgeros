'use client';

import * as React from 'react';
import { Button, TextField, tokens, required, email as emailValidator, phone as phoneValidator, validateForm } from '@7f/ui';
import { createCustomer } from './actions';

/**
 * Frontend Completion, FE-3.2 — no `entityId` prop, same reasoning as
 * `CreateVendorForm`: `Customer` has no `entityId` column either
 * (confirmed against `schema.prisma`).
 *
 * ADDENDUM (FE-10.5) — Validation, same shared-validator wiring
 * `CreateLeadForm` gets this same checkpoint, and for the same reason:
 * this form's `code`/`name`/`email`/`phone` shape is fielded-for-field
 * the same "two required, two optional-with-a-real-format" shape as
 * CreateLeadForm's `firstName`/`lastName`/`email`/`phone` — the two
 * forms this checkpoint scoped itself to specifically because of that
 * shared shape, not because CRM and Dimensions are otherwise related
 * modules.
 *
 * Also sets `noValidate` on the `<form>`, for the exact same reason as
 * `CreateLeadForm` this same checkpoint: without it, native constraint
 * validation on `required`/`type="email"` blocks submission before
 * `handleSubmit` runs at all, pre-empting `fieldErrors` with an
 * unstyled native tooltip instead.
 */
export function CreateCustomerForm() {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateForm(
      { code, name, email, phone },
      { code: [required('Code is required')], name: [required('Name is required')], email: [emailValidator()], phone: [phoneValidator()] },
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setPending(true);
    setError(null);

    const result = await createCustomer({
      code,
      name,
      email: email || undefined,
      phone: phone || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create customer.');
      return;
    }
    setCode('');
    setName('');
    setEmail('');
    setPhone('');
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
      <TextField
        label="Email (optional)"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setFieldErrors(({ email: _drop, ...rest }) => rest);
        }}
        error={fieldErrors.email}
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Phone (optional)"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setFieldErrors(({ phone: _drop, ...rest }) => rest);
        }}
        error={fieldErrors.phone}
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add customer'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
