'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { manualMatchLine } from './actions';

/**
 * Frontend Completion, FE-3.6 — both `bankStatementLineId` and
 * `journalLineId` are real `Select`s, unlike the plain id `TextField`s
 * this checkpoint uses elsewhere for `BankAccount`/`statementId`: here
 * the options come from `getSessionSummary`'s own
 * `unmatchedStatementLines`/`unmatchedBookLines` arrays that
 * `page.tsx` already fetched to render the summary tables — a real,
 * already-in-hand list, not a missing registry, so there's no reason to
 * fall back to a bare id field the way `CreatePurchaseOrderForm`'s own
 * `requisitionId` does.
 */
export function ManualMatchForm({
  sessionId,
  statementLineOptions,
  bookLineOptions,
}: {
  sessionId: string;
  statementLineOptions: SelectOption[];
  bookLineOptions: SelectOption[];
}) {
  const [bankStatementLineId, setBankStatementLineId] = React.useState('');
  const [journalLineId, setJournalLineId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await manualMatchLine(sessionId, {
      bankStatementLineId,
      journalLineId,
      notes: notes || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to record manual match.');
      return;
    }
    setBankStatementLineId('');
    setJournalLineId('');
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
        marginBottom: tokens.space(4),
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
        label="Book (journal) line"
        value={journalLineId}
        onChange={(e) => setJournalLineId(e.target.value)}
        options={bookLineOptions}
        placeholder="Select a book line…"
        required
        style={{ minWidth: '260px' }}
      />
      <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minWidth: '200px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Matching…' : 'Match'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
