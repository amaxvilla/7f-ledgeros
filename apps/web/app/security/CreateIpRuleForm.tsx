'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createIpRule } from './actions';

const SCOPE_OPTIONS = [
  { value: 'GLOBAL', label: 'Global — applies to every user' },
  { value: 'USER', label: 'User — applies to one specific user' },
];

/**
 * Frontend Completion — seventh data-entry form, following
 * CreateTenantForm (Checkpoint Q) and every form since (see any of
 * their own doc comments for the shared conventions: manual
 * pending/error useState, 'use client' form + 'use server' action
 * split, reset-on-success).
 *
 * `scope` uses Select — IpRuleScope is a real two-value Prisma enum
 * (GLOBAL/USER), the same "real fixed enum, not free text" bar
 * CreateTaxCodeForm's taxType and CreateLeaseForm's rentFrequency both
 * cleared.
 *
 * `userId` is conditionally rendered — only shown once scope === 'USER'
 * (CreateIpRuleDto's own comment: userId must be omitted when scope is
 * GLOBAL) — the first form in this app whose fields depend on another
 * field's value, not a new pattern this component invented so much as
 * the first one that had a genuine reason to need it.
 *
 * No `entityId` prop — IpAllowlistRule is system-wide, matching
 * SecurityPage's own "no EntitySelector, not entity-scoped" posture
 * (see that page's own doc comment) — the same reasoning
 * CreateTaxCodeForm's own missing entityId prop gives for TaxCode being
 * shared reference data, applied here to a different kind of
 * non-entity-scoped resource.
 */
export function CreateIpRuleForm() {
  const [scope, setScope] = React.useState('');
  const [cidr, setCidr] = React.useState('');
  const [userId, setUserId] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createIpRule({
      scope,
      cidr,
      userId: scope === 'USER' ? userId || undefined : undefined,
      label: label || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create IP restriction rule.');
      return;
    }
    setScope('');
    setCidr('');
    setUserId('');
    setLabel('');
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
      <Select
        label="Scope"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        options={SCOPE_OPTIONS}
        placeholder="Select a scope…"
        required
        style={{ minWidth: '260px' }}
      />
      {scope === 'USER' && (
        <TextField
          label="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
          style={{ minWidth: '200px' }}
        />
      )}
      <TextField
        label="CIDR"
        value={cidr}
        onChange={(e) => setCidr(e.target.value)}
        placeholder="e.g. 203.0.113.0/24"
        required
        style={{ minWidth: '180px' }}
      />
      <TextField label="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ minWidth: '180px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add IP rule'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
