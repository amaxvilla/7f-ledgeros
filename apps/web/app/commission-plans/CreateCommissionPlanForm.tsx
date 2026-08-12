'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createCommissionPlan } from './actions';

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'FIXED', label: 'Fixed amount' },
];

const SCOPE_OPTIONS: SelectOption[] = [
  { value: 'GLOBAL', label: 'Global (entity default)' },
  { value: 'PROJECT', label: 'Project-specific' },
  { value: 'ESTATE', label: 'Estate-specific' },
  { value: 'UNIT', label: 'Unit-specific' },
  { value: 'AGENT', label: 'Agent-specific' },
];

const REFERRAL_OPTIONS: SelectOption[] = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes — referral plan' },
];

/**
 * Flat (non-tiered) commission plans only — see `actions.ts`'s own doc
 * comment for why a tiered-schedule row editor is deferred to a
 * separate checkpoint. The single scope-target field shown depends on
 * `scope`, matching `CommissionPlanService.validateScopeTarget`'s own
 * rule exactly (confirmed directly before building this): GLOBAL shows
 * none, every other scope shows exactly the one matching id field as a
 * plain text input (this app has no Project/Estate/Unit picker
 * component yet — same gap `/agent-assignments`'s own `AgentSelector`
 * doc comment already named for Agent lookups elsewhere, not solved
 * here either).
 */
export function CreateCommissionPlanForm({ entityId }: { entityId: string }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [scope, setScope] = React.useState<'GLOBAL' | 'PROJECT' | 'ESTATE' | 'UNIT' | 'AGENT'>('GLOBAL');
  const [targetId, setTargetId] = React.useState('');
  const [rateOrAmount, setRateOrAmount] = React.useState('');
  const [isReferral, setIsReferral] = React.useState('false');
  const [effectiveFrom, setEffectiveFrom] = React.useState('');
  const [effectiveTo, setEffectiveTo] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const scopeFieldLabel: Record<typeof scope, string | null> = {
    GLOBAL: null,
    PROJECT: 'Project ID',
    ESTATE: 'Estate ID',
    UNIT: 'Unit ID',
    AGENT: 'Agent ID',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const numeric = rateOrAmount === '' ? undefined : Number(rateOrAmount);

    const result = await createCommissionPlan({
      entityId,
      code,
      name,
      type,
      scope,
      projectId: scope === 'PROJECT' ? targetId : undefined,
      estateId: scope === 'ESTATE' ? targetId : undefined,
      unitId: scope === 'UNIT' ? targetId : undefined,
      agentId: scope === 'AGENT' ? targetId : undefined,
      rate: type === 'PERCENTAGE' ? numeric : undefined,
      fixedAmount: type === 'FIXED' ? numeric : undefined,
      isReferral: isReferral === 'true',
      effectiveFrom,
      effectiveTo: effectiveTo || undefined,
      notes: notes || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create commission plan.');
      return;
    }
    setCode('');
    setName('');
    setTargetId('');
    setRateOrAmount('');
    setIsReferral('false');
    setEffectiveFrom('');
    setEffectiveTo('');
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
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CP-001" required style={{ minWidth: '120px' }} />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
      <Select label="Type" value={type} onChange={(e) => setType(e.target.value as typeof type)} options={TYPE_OPTIONS} style={{ minWidth: '160px' }} />
      <Select
        label="Scope"
        value={scope}
        onChange={(e) => {
          setScope(e.target.value as typeof scope);
          setTargetId('');
        }}
        options={SCOPE_OPTIONS}
        style={{ minWidth: '190px' }}
      />
      {scopeFieldLabel[scope] && (
        <TextField
          label={scopeFieldLabel[scope]!}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          required
          style={{ minWidth: '200px' }}
        />
      )}
      <TextField
        label={type === 'PERCENTAGE' ? 'Rate (%)' : 'Fixed amount'}
        type="number"
        step="0.0001"
        value={rateOrAmount}
        onChange={(e) => setRateOrAmount(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <Select label="Referral plan" value={isReferral} onChange={(e) => setIsReferral(e.target.value)} options={REFERRAL_OPTIONS} style={{ minWidth: '160px' }} />
      <TextField label="Effective from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="Effective to (optional)" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} style={{ minWidth: '160px' }} />
      <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minWidth: '200px' }} />

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create plan'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
