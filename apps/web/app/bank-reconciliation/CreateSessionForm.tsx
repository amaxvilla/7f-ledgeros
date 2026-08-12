'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createReconciliationSession } from './actions';

/**
 * Frontend Completion, FE-3.6 — `bankGlAccountId` is a real `Select`
 * sourced from `accountOptions` (`GET /accounts`) — it's the GL cash
 * account this session reconciles against, the same registry
 * `general-ledger/page.tsx` already fetches. `bankAccountId` and
 * `statementId` both stay plain id `TextField`s: see `actions.ts`'s own
 * doc comment for why `BankAccount` has no registry, and `statementId`
 * is exactly the id `ImportStatementForm` just displayed on success —
 * there's no list to pick it from either.
 */
export function CreateSessionForm({ entityId, accountOptions }: { entityId: string; accountOptions: SelectOption[] }) {
  const [bankAccountId, setBankAccountId] = React.useState('');
  const [statementId, setStatementId] = React.useState('');
  const [bankGlAccountId, setBankGlAccountId] = React.useState('');
  const [sessionDate, setSessionDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSessionId(null);

    const result = await createReconciliationSession({
      entityId,
      bankAccountId,
      statementId,
      bankGlAccountId,
      sessionDate,
    });

    setPending(false);
    if (result.ok) {
      setBankAccountId('');
      setStatementId('');
      setBankGlAccountId('');
      setSessionDate('');
      setSessionId(result.id ?? null);
    } else {
      setError(result.error ?? 'Failed to create reconciliation session.');
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
      <TextField label="Bank account ID" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Statement ID" value={statementId} onChange={(e) => setStatementId(e.target.value)} required style={{ minWidth: '220px' }} />
      <Select
        label="Bank GL account"
        value={bankGlAccountId}
        onChange={(e) => setBankGlAccountId(e.target.value)}
        options={accountOptions}
        placeholder="Select an account…"
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Session date" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required style={{ minWidth: '160px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create session'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {sessionId && (
        <div style={{ width: '100%', fontFamily: tokens.font.mono, fontSize: '13px', color: tokens.color.positive }}>
          Session created. Session ID: {sessionId}
        </div>
      )}
    </form>
  );
}
