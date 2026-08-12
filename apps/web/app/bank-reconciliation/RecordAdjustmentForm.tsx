'use client';

import * as React from 'react';
import { Button, Select, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { recordAdjustment } from './actions';

const ADJUSTMENT_TYPE_OPTIONS = [
  { value: 'BANK_CHARGE', label: 'Bank charge' },
  { value: 'INTEREST_INCOME', label: 'Interest income' },
];

/**
 * Frontend Completion, FE-3.6 — `adjustmentType` uses `Select` with the
 * DTO's own two `@IsIn` values (confirmed directly). `contraAccountId`
 * is a real `Select` sourced from `accountOptions` (`GET /accounts`) —
 * the GL account for "the other side of the entry" (the DTO's own
 * inline comment), same registry every other GL-account field on this
 * page's siblings already uses. `bankStatementLineId` reuses
 * `ManualMatchForm`'s own `statementLineOptions` prop — same
 * already-in-hand list, same reasoning.
 */
export function RecordAdjustmentForm({
  sessionId,
  statementLineOptions,
  accountOptions,
}: {
  sessionId: string;
  statementLineOptions: SelectOption[];
  accountOptions: SelectOption[];
}) {
  const [bankStatementLineId, setBankStatementLineId] = React.useState('');
  const [adjustmentType, setAdjustmentType] = React.useState('');
  const [contraAccountId, setContraAccountId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await recordAdjustment(sessionId, {
      bankStatementLineId,
      adjustmentType: adjustmentType as 'BANK_CHARGE' | 'INTEREST_INCOME',
      contraAccountId,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to record adjustment.');
      return;
    }
    setBankStatementLineId('');
    setAdjustmentType('');
    setContraAccountId('');
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
        label="Statement line"
        value={bankStatementLineId}
        onChange={(e) => setBankStatementLineId(e.target.value)}
        options={statementLineOptions}
        placeholder="Select a statement line…"
        required
        style={{ minWidth: '260px' }}
      />
      <Select
        label="Adjustment type"
        value={adjustmentType}
        onChange={(e) => setAdjustmentType(e.target.value)}
        options={ADJUSTMENT_TYPE_OPTIONS}
        placeholder="Select a type…"
        required
        style={{ minWidth: '180px' }}
      />
      <Select
        label="Contra GL account"
        value={contraAccountId}
        onChange={(e) => setContraAccountId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record adjustment'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
