'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { updateEntity } from './actions';

const CONSOLIDATION_OPTIONS = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
];

interface EntityFormValues {
  code: string;
  name: string;
  legalName: string;
  taxIdentificationNumber: string;
  registrationNumber: string;
  baseCurrency: string;
  fiscalYearStartMonth: string;
  parentEntityId: string;
  isConsolidationParent: boolean;
}

/**
 * Frontend Completion — Entities, `/entities/[id]`, the detail-page
 * checkpoint FE-8.2's own report deferred `update` to. Same 9-field set
 * `CreateEntityForm.tsx` already has (`UpdateEntityDto` is
 * `PartialType(CreateEntityDto)`, confirmed directly — an identical
 * field list, not a subset), but a "settings" form, not a "new entry"
 * one: pre-filled from the entity's current values and does NOT reset
 * after a successful save — the same posture `PasswordPolicyForm.tsx`/
 * `UserRolesForm.tsx` already established for editing something that
 * already exists, rather than `CreateEntityForm`'s own reset-to-blank
 * behavior.
 *
 * `parentOptions` EXCLUDES this entity's own id — a genuine, deliberate
 * departure from this app's usual "let the backend validate, don't
 * duplicate the check client-side" posture. Checked `EntitiesService.update`
 * directly: it does no cycle or self-reference check at all (a bare
 * `prisma.entity.update` with whatever `parentEntityId` arrives), and
 * `getHierarchyChain` (`while (current.parentEntityId) { ... }`, also
 * read directly) has no cycle guard either — a self-referencing
 * `parentEntityId` wouldn't produce a clean rejected request the way
 * every other server-validated field in this app does, it would let
 * `getHierarchyChain` loop forever the next time anyone calls it. That
 * failure mode (a different endpoint hanging later) isn't one "let the
 * backend surface its own error" can respond to, so it's prevented here
 * instead — not routine duplication, a genuine backend gap this form
 * works around because nothing else does.
 */
export function EditEntityForm({
  entityId,
  initialValues,
  parentOptions,
}: {
  entityId: string;
  initialValues: EntityFormValues;
  parentOptions: SelectOption[];
}) {
  const [code, setCode] = React.useState(initialValues.code);
  const [name, setName] = React.useState(initialValues.name);
  const [legalName, setLegalName] = React.useState(initialValues.legalName);
  const [taxIdentificationNumber, setTaxIdentificationNumber] = React.useState(initialValues.taxIdentificationNumber);
  const [registrationNumber, setRegistrationNumber] = React.useState(initialValues.registrationNumber);
  const [baseCurrency, setBaseCurrency] = React.useState(initialValues.baseCurrency);
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = React.useState(initialValues.fiscalYearStartMonth);
  const [parentEntityId, setParentEntityId] = React.useState(initialValues.parentEntityId);
  const [isConsolidationParent, setIsConsolidationParent] = React.useState(String(initialValues.isConsolidationParent));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updateEntity(entityId, {
      code,
      name,
      legalName,
      taxIdentificationNumber: taxIdentificationNumber || undefined,
      registrationNumber: registrationNumber || undefined,
      baseCurrency: baseCurrency || undefined,
      fiscalYearStartMonth: fiscalYearStartMonth === '' ? undefined : Number(fiscalYearStartMonth),
      parentEntityId: parentEntityId || undefined,
      isConsolidationParent: isConsolidationParent === 'true',
    });

    setPending(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error ?? 'Failed to save entity.');
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
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ minWidth: '120px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Legal name" value={legalName} onChange={(e) => setLegalName(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField
        label="Tax ID (optional)"
        value={taxIdentificationNumber}
        onChange={(e) => setTaxIdentificationNumber(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Registration number (optional)"
        value={registrationNumber}
        onChange={(e) => setRegistrationNumber(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Base currency (optional)"
        value={baseCurrency}
        onChange={(e) => setBaseCurrency(e.target.value)}
        placeholder="NGN"
        style={{ minWidth: '130px' }}
      />
      <TextField
        label="Fiscal year start month (optional)"
        type="number"
        min={1}
        max={12}
        value={fiscalYearStartMonth}
        onChange={(e) => setFiscalYearStartMonth(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Parent entity (optional)"
        value={parentEntityId}
        onChange={(e) => setParentEntityId(e.target.value)}
        options={parentOptions}
        placeholder="No parent (top-level entity)"
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Consolidation parent"
        value={isConsolidationParent}
        onChange={(e) => setIsConsolidationParent(e.target.value)}
        options={CONSOLIDATION_OPTIONS}
        style={{ minWidth: '110px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
      {saved && !error && (
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>Saved.</span>
      )}
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
