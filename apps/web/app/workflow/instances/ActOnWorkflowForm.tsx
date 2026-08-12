'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { actOnWorkflowInstance } from './actions';

const ACTION_OPTIONS = [
  { value: 'SUBMIT', label: 'Submit' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'RETURN', label: 'Return' },
  { value: 'POST', label: 'Post' },
  { value: 'ARCHIVE', label: 'Archive' },
  { value: 'COMMENT', label: 'Comment only' },
];

/**
 * Frontend Completion, FE-8.7 — see `actions.ts`'s own doc comment for
 * why all 8 `WorkflowActionType` values are offered rather than a
 * narrowed subset. Only rendered by the detail page when the instance
 * is `IN_PROGRESS` (confirmed directly this is the only status
 * `WorkflowEngineService.act` accepts — every other status throws
 * `ConflictException` before even checking for an active stage).
 */
export function ActOnWorkflowForm({ instanceId }: { instanceId: string }) {
  const [action, setAction] = React.useState('');
  const [comments, setComments] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await actOnWorkflowInstance(instanceId, action, comments || undefined);

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to record workflow action.');
      return;
    }
    setAction('');
    setComments('');
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
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Action"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        options={ACTION_OPTIONS}
        placeholder="Choose an action…"
        required
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Comments (optional)"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        style={{ minWidth: '260px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit action'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
