'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createAccount } from './actions';

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
];

const ACCOUNT_CATEGORY_OPTIONS = [
  { value: 'CURRENT_ASSET', label: 'Current asset' },
  { value: 'NON_CURRENT_ASSET', label: 'Non-current asset' },
  { value: 'CURRENT_LIABILITY', label: 'Current liability' },
  { value: 'NON_CURRENT_LIABILITY', label: 'Non-current liability' },
  { value: 'SHARE_CAPITAL', label: 'Share capital' },
  { value: 'RETAINED_EARNINGS', label: 'Retained earnings' },
  { value: 'OTHER_EQUITY', label: 'Other equity' },
  { value: 'OPERATING_REVENUE', label: 'Operating revenue' },
  { value: 'OTHER_REVENUE', label: 'Other revenue' },
  { value: 'COST_OF_SALES', label: 'Cost of sales' },
  { value: 'OPERATING_EXPENSE', label: 'Operating expense' },
  { value: 'FINANCE_EXPENSE', label: 'Finance expense' },
  { value: 'TAX_EXPENSE', label: 'Tax expense' },
];

/**
 * Frontend Completion, FE-3.1 — this module's first data-entry form,
 * following `CreateTaxCodeForm`'s pattern exactly (see that component's
 * own doc comment for the shared conventions this repeats): manual
 * pending/error `useState`, `'use client'` form + `'use server'` action
 * split, no `entityId` prop — `CreateAccountDto` has none, same as
 * `CreateTaxCodeDto`, because Account is shared reference data across
 * every entity (see `page.tsx`'s own doc comment on why the Chart of
 * Accounts table itself isn't entity-filtered either).
 *
 * `accountType` and `accountCategory` are real Prisma enums (five and
 * thirteen values respectively, confirmed directly against
 * `schema.prisma`) and both use `Select`, not `TextField` — the same
 * "enum field, not free text" upgrade `CreateTaxCodeForm`'s own
 * `taxType` already got once `Select` existed.
 *
 * `ifrsMapping` and `parentAccountId` stay optional `TextField`s: both
 * are genuinely free-form on the DTO (`ifrsMapping` is descriptive text
 * like "IAS 1 - Current Assets", not a fixed set; `parentAccountId` is
 * an id from this same Account table with no dedicated picker
 * endpoint) — the same "id/free-text field, not an enum" reasoning
 * `CreateTaxCodeForm`'s own `taxAuthorityAccountId` doc comment gives.
 * `isControlAccount`/`isPostable` are left off this form entirely
 * (both optional booleans that default sensibly server-side —
 * `isControlAccount` to `false`, `isPostable` to `true`): no checkbox
 * primitive exists yet in `@7f/ui` (only `TextField`/`Select`), and
 * inventing one just for two optional flags on this form isn't this
 * checkpoint's job — the same restraint `Select`'s own doc comment
 * models for not guessing at unbuilt primitives.
 */
export function CreateAccountForm() {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [accountType, setAccountType] = React.useState('');
  const [accountCategory, setAccountCategory] = React.useState('');
  const [ifrsMapping, setIfrsMapping] = React.useState('');
  const [parentAccountId, setParentAccountId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createAccount({
      code,
      name,
      accountType,
      accountCategory,
      ifrsMapping: ifrsMapping || undefined,
      parentAccountId: parentAccountId || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create account.');
      return;
    }
    setCode('');
    setName('');
    setAccountType('');
    setAccountCategory('');
    setIfrsMapping('');
    setParentAccountId('');
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
      <Select
        label="Account type"
        value={accountType}
        onChange={(e) => setAccountType(e.target.value)}
        options={ACCOUNT_TYPE_OPTIONS}
        placeholder="Select a type…"
        required
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Account category"
        value={accountCategory}
        onChange={(e) => setAccountCategory(e.target.value)}
        options={ACCOUNT_CATEGORY_OPTIONS}
        placeholder="Select a category…"
        required
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="IFRS mapping (optional)"
        value={ifrsMapping}
        onChange={(e) => setIfrsMapping(e.target.value)}
        placeholder="e.g. IAS 1 - Current Assets"
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Parent account ID (optional)"
        value={parentAccountId}
        onChange={(e) => setParentAccountId(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add account'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
