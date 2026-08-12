'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { calculateCommission } from './actions';

const BASIS_OPTIONS: SelectOption[] = [
  { value: 'GROSS', label: 'Gross sale value' },
  { value: 'NET', label: 'Net sale value (after discount)' },
];

const COLLECTION_OPTIONS: SelectOption[] = [
  { value: 'FULL', label: 'Full — compute on the entire basis' },
  { value: 'COLLECTED', label: 'Collected — prorate to % actually paid so far' },
];

/**
 * Requires a SALE-scope AgentAssignment's own id — this app has no
 * assignment picker component yet (the same gap `CreateCommissionPlanForm`'s
 * own doc comment already named for Project/Estate/Unit ids), so the
 * assignment id is entered directly; `/agent-assignments` is where that
 * id is created and can be copied from.
 */
export function CalculateCommissionForm() {
  const [agentAssignmentId, setAgentAssignmentId] = React.useState('');
  const [basisType, setBasisType] = React.useState<'GROSS' | 'NET'>('GROSS');
  const [discountAmount, setDiscountAmount] = React.useState('');
  const [collectionBasis, setCollectionBasis] = React.useState<'FULL' | 'COLLECTED'>('FULL');
  const [whtTaxCodeId, setWhtTaxCodeId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await calculateCommission({
      agentAssignmentId,
      basisType,
      discountAmount: discountAmount === '' ? undefined : Number(discountAmount),
      collectionBasis,
      whtTaxCodeId: whtTaxCodeId || undefined,
      notes: notes || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to calculate commission.');
      return;
    }
    setAgentAssignmentId('');
    setDiscountAmount('');
    setWhtTaxCodeId('');
    setNotes('');
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
      <TextField
        label="Agent Assignment ID (SALE scope)"
        value={agentAssignmentId}
        onChange={(e) => setAgentAssignmentId(e.target.value)}
        required
        style={{ minWidth: '260px' }}
      />
      <Select label="Basis" value={basisType} onChange={(e) => setBasisType(e.target.value as typeof basisType)} options={BASIS_OPTIONS} style={{ minWidth: '220px' }} />
      {basisType === 'NET' && (
        <TextField
          label="Discount amount"
          type="number"
          step="0.01"
          value={discountAmount}
          onChange={(e) => setDiscountAmount(e.target.value)}
          style={{ minWidth: '160px' }}
        />
      )}
      <Select
        label="Collection basis"
        value={collectionBasis}
        onChange={(e) => setCollectionBasis(e.target.value as typeof collectionBasis)}
        options={COLLECTION_OPTIONS}
        style={{ minWidth: '260px' }}
      />
      <TextField
        label="WHT tax code ID (optional)"
        value={whtTaxCodeId}
        onChange={(e) => setWhtTaxCodeId(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minWidth: '200px' }} />

      <Button type="submit" disabled={pending || !agentAssignmentId}>
        {pending ? 'Calculating…' : 'Calculate commission'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
