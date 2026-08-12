'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { triggerDashboardRefresh } from './actions';

/**
 * Frontend Completion, FE-8.5 — the simpler of this checkpoint's two
 * trigger forms: `TriggerDashboardRefreshDto` has exactly one optional
 * field (confirmed directly). Left blank, `entityId` is sent as
 * `undefined` (JSON.stringify drops it entirely, matching every other
 * optional-field action in this app) — `QueueProducerService
 * .enqueueDashboardRefresh` presumably refreshes system-wide in that
 * case, not investigated further here since it's the job worker's own
 * concern, not this form's.
 */
export function TriggerDashboardRefreshForm() {
  const [entityId, setEntityId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    const result = await triggerDashboardRefresh(entityId || undefined);
    setPending(false);
    if (result.ok) {
      setSuccess(true);
    } else {
      setError(result.error ?? 'Failed to queue a dashboard refresh.');
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
        marginBottom: tokens.space(4),
      }}
    >
      <TextField
        label="Entity ID (optional)"
        value={entityId}
        onChange={(e) => setEntityId(e.target.value)}
        placeholder="Leave blank to refresh all entities"
        style={{ minWidth: '260px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Queuing…' : 'Trigger dashboard refresh'}
      </Button>
      {success && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>Queued.</span>}
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{error}</span>}
    </form>
  );
}
