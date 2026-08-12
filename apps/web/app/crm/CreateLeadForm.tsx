'use client';

import * as React from 'react';
import { Button, TextField, tokens, required, email as emailValidator, phone as phoneValidator, validateForm } from '@7f/ui';
import { createLead } from './actions';

/**
 * Frontend Completion — second data-entry form, following
 * CreateTenantForm's (Checkpoint Q) precedent exactly: same manual
 * pending/error useState (no useTransition — still no precedent for it
 * anywhere in this app), same "'use client' form calls a 'use server'
 * action, which is the only place the API token can be attached"
 * split, same revalidatePath-on-success.
 *
 * `source` is a plain TextField for the LeadSource enum value (e.g.
 * "WEBSITE", "REFERRAL"), not a <select> — @7f/ui has no Select/dropdown
 * component yet, and CreateTenantForm's own doc comment already
 * establishes the precedent of shipping the simplest correct version of
 * a field first rather than a checkpoint also having to build a new
 * form primitive. A future checkpoint adding Select to @7f/ui can
 * upgrade this field without touching this form's submit logic.
 *
 * ADDENDUM (FE-10.5) — Validation. Before this checkpoint, "First name"
 * and "Last name" relied on nothing but the native `required` attribute
 * (bypassable via a plain `<form>` submit in some browsers, and gives
 * no per-field message), and "Email (optional)" was never checked for
 * being a *valid* email at all — a typo went straight to the API and
 * came back, if it came back as an error at all, as a generic
 * whole-form message. `fieldSchema` is this form's own local map from
 * field name to the shared `@7f/ui` validators (`required`/`email`);
 * `handleSubmit` runs it before ever calling `createLead`, and only
 * calls the Server Action once `validateForm` reports no errors —
 * exactly the same "first, cheapest check wins" precedent
 * `CreateLeadForm` already used for optional-field omission
 * (`email || undefined`), just applied one step earlier in the same
 * function. `source` has no validator here — it stays exactly as
 * optional and unchecked as it was before this checkpoint; the doc
 * comment above still applies to it unchanged.
 *
 * The `<form>` itself now sets `noValidate`: without it, the browser's
 * own native constraint validation (triggered by `required` and
 * `type="email"`) intercepts submission before `handleSubmit` ever
 * runs, surfacing an unstyled native tooltip this codebase has no way
 * to theme instead of the message `fieldErrors` now renders through
 * `TextField`'s own `error` prop. `required` itself stays on the two
 * mandatory fields for its semantic/`:invalid`/accessibility value —
 * only the browser's own submit-blocking behavior is turned off.
 */
export function CreateLeadForm({ entityId }: { entityId: string }) {
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [source, setSource] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateForm(
      { firstName, lastName, email, phone },
      { firstName: [required('First name is required')], lastName: [required('Last name is required')], email: [emailValidator()], phone: [phoneValidator()] },
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setPending(true);
    setError(null);

    const result = await createLead({
      entityId,
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
      source: source || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create lead.');
      return;
    }
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setSource('');
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
        label="First name"
        value={firstName}
        onChange={(e) => {
          setFirstName(e.target.value);
          setFieldErrors(({ firstName: _drop, ...rest }) => rest);
        }}
        required
        error={fieldErrors.firstName}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Last name"
        value={lastName}
        onChange={(e) => {
          setLastName(e.target.value);
          setFieldErrors(({ lastName: _drop, ...rest }) => rest);
        }}
        required
        error={fieldErrors.lastName}
        style={{ minWidth: '160px' }}
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
      <TextField
        label="Source (optional)"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="WEBSITE, REFERRAL, WALK_IN…"
        style={{ minWidth: '200px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add lead'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
