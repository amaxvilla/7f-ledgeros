'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createStockItem } from './actions';

const DOMAIN_OPTIONS = [
  { value: 'CONSTRUCTION_MATERIALS', label: 'Construction materials' },
  { value: 'TOOLS_EQUIPMENT', label: 'Tools & equipment' },
  { value: 'HSE_SUPPLIES', label: 'HSE supplies' },
  { value: 'OFFICE_SUPPLIES', label: 'Office supplies' },
  { value: 'PROPERTY_INVENTORY', label: 'Property inventory' },
];

/**
 * Frontend Completion, FE-3.4 — `domain` is a real five-value Prisma
 * enum (`InventoryDomain`, confirmed directly against `schema.prisma`),
 * so it uses `Select`, the same "enum field, not free text" choice
 * `CreateAccountForm`'s own `accountType`/`accountCategory` fields
 * make. `unitOfMeasure` stays a plain `TextField` — it's a genuinely
 * free-form string on the controller's own inline type (e.g. "kg",
 * "each", "m3"), not an enum.
 */
export function CreateStockItemForm({ entityId }: { entityId: string }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [unitOfMeasure, setUnitOfMeasure] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createStockItem({ entityId, code, name, domain, unitOfMeasure });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create stock item.');
      return;
    }
    setCode('');
    setName('');
    setDomain('');
    setUnitOfMeasure('');
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
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
      <Select
        label="Domain"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        options={DOMAIN_OPTIONS}
        placeholder="Select a domain…"
        required
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Unit of measure"
        value={unitOfMeasure}
        onChange={(e) => setUnitOfMeasure(e.target.value)}
        placeholder="e.g. kg, each, m3"
        required
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add stock item'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
