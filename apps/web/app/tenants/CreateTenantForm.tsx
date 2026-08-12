'use client';

import * as React from 'react';
import { Button, TextField, tokens, required, uuid as uuidValidator, validateForm } from '@7f/ui';
import { createTenant } from './actions';

/**
 * Frontend Completion, Checkpoint Q — the first data-entry form in this
 * app (every page through Checkpoint P has been read-only). Lives here
 * rather than in @7f/ui — this form's shape (which fields, which
 * endpoint) is specific to CreateTenantDto (apps/api/src/lease/dto/
 * lease.dto.ts), the same "page-specific composition vs. reusable
 * primitive" split TextField/Button (@7f/ui) vs. EntitySelector
 * (apps/web, page-local) already draws.
 *
 * `customerId`/`unitId` are PLAIN TEXT INPUTS for real UUIDs here, not
 * a searchable customer/unit picker — a deliberate, documented
 * simplification for this first form checkpoint (matching this
 * codebase's own established "correct but intentionally the simplest
 * version first" precedent, e.g. MonoProvider's no-recipient-caching
 * note or fetchStatement's no-pagination note) rather than this
 * checkpoint also having to design and build a new search/autocomplete
 * pattern that doesn't exist anywhere in this UI yet. A future
 * checkpoint replacing these two fields with a proper picker doesn't
 * need to change this form's submit/error-handling logic at all.
 *
 * Manual pending/error state (useState, not useTransition) — this repo
 * has no precedent yet for useTransition-driven pending UI, and a
 * simple boolean covers this form's one-mutation-at-a-time need without
 * introducing a pattern nothing else here follows yet.
 *
 * ADDENDUM (FE-10.6) — Validation, second rollout checkpoint (after
 * CreateLeadForm/CreateCustomerForm, FE-10.5). `customerId`/`unitId`
 * being plain-text UUID fields (see this form's own doc comment above)
 * is exactly the gap `@7f/ui`'s new `uuid()` validator was added for —
 * a real UUID and any other garbage string were previously
 * indistinguishable to this form until the API rejected one; now a
 * malformed id is caught before ever calling `createTenant`. `notes`
 * has no validator, unchanged. `moveInDate` gets `required()` only —
 * its native `type="date"` input already constrains the value to a
 * real date whenever one is entered at all, so the only gap
 * client-side validation needed to close for it was the same
 * "was this left blank" check `noValidate` (below) stopped the browser
 * from enforcing on its own.
 */
export function CreateTenantForm({ entityId }: { entityId: string }) {
  const [customerId, setCustomerId] = React.useState('');
  const [unitId, setUnitId] = React.useState('');
  const [moveInDate, setMoveInDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateForm(
      { customerId, unitId, moveInDate },
      {
        customerId: [required('Customer ID is required'), uuidValidator()],
        unitId: [required('Unit ID is required'), uuidValidator()],
        moveInDate: [required('Move-in date is required')],
      },
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setPending(true);
    setError(null);

    const result = await createTenant({
      entityId,
      customerId,
      unitId,
      moveInDate,
      notes: notes || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create tenant.');
      return;
    }
    setCustomerId('');
    setUnitId('');
    setMoveInDate('');
    setNotes('');
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
        label="Customer ID"
        value={customerId}
        onChange={(e) => {
          setCustomerId(e.target.value);
          setFieldErrors(({ customerId: _drop, ...rest }) => rest);
        }}
        placeholder="customer UUID"
        required
        error={fieldErrors.customerId}
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Unit ID"
        value={unitId}
        onChange={(e) => {
          setUnitId(e.target.value);
          setFieldErrors(({ unitId: _drop, ...rest }) => rest);
        }}
        placeholder="unit UUID"
        required
        error={fieldErrors.unitId}
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Move-in date"
        type="date"
        value={moveInDate}
        onChange={(e) => {
          setMoveInDate(e.target.value);
          setFieldErrors(({ moveInDate: _drop, ...rest }) => rest);
        }}
        required
        error={fieldErrors.moveInDate}
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="optional"
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add tenant'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
