'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { resubmitWorkflowInstance } from './actions';

/**
 * Frontend Completion, FE-8.7 — no-fields button, the same shape
 * `FinalizeChecklistButton`/`CorrectiveActionActions` already
 * established elsewhere in this app. Only rendered by the detail page
 * when the instance's status is `RETURNED` — confirmed directly this
 * is the only status `resubmit` accepts (`ConflictException`
 * otherwise), the same "don't offer a click the backend would reject"
 * posture those precedents already take.
 */
export function ResubmitInstanceButton({ instanceId }: { instanceId: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleResubmit() {
    setPending(true);
    setError(null);
    const result = await resubmitWorkflowInstance(instanceId);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to resubmit workflow instance.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-start' }}>
      <Button type="button" disabled={pending} onClick={handleResubmit}>
        {pending ? 'Resubmitting…' : 'Resubmit'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
