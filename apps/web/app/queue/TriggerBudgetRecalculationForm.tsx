'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { triggerBudgetRecalculation } from './actions';

/**
 * Frontend Completion, FE-8.5 — the second of this checkpoint's two
 * trigger forms. `TriggerBudgetRecalculationDto` has two optional
 * fields (confirmed directly, neither required) — both left blank is a
 * valid submission, same "an all-optional DTO doesn't need a required
 * field just to feel like a real form" posture this app already takes
 * elsewhere (`TriggerDashboardRefreshForm`, this checkpoint's sibling).
 */
export function TriggerBudgetRecalculationForm() {
  const [budgetId, setBudgetId] = React.useState('');
  const [entityId, setEntityId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    const result = await triggerBudgetRecalculation(budgetId || undefined, entityId || undefined);
    setPending(false);
    if (result.ok) {
      setSuccess(true);
    } else {
      setError(result.error ?? 'Failed to queue a budget recalculation.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: tokens.space(2),
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        padding: tokens.space(4),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.space(8),
      }}
    >
      <TextField
        label="Budget ID (optional)"
        value={budgetId}
        onChange={(e) => setBudgetId(e.target.value)}
        placeholder="Leave blank to recalculate broadly"
        style={{ minWidth: '220px' }}
      />
      <TextField
        label="Entity ID (optional)"
        value={entityId}
        onChange={(e) => setEntityId(e.target.value)}
        placeholder="Leave blank for all entities"
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Queuing…' : 'Trigger budget recalculation'}
      </Button>
      {success && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>Queued.</span>}
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{error}</span>}
    </form>
  );
}
