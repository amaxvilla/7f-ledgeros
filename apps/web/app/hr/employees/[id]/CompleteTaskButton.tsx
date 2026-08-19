'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { completeOnboardingTask } from '../actions';

export function CompleteTaskButton({ taskId, employeeId, status }: { taskId: string; employeeId: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status === 'COMPLETED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.positive }}>Done</span>;
  }

  async function handleComplete() {
    setPending(true);
    setError(null);
    const result = await completeOnboardingTask(taskId, employeeId);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to complete task.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      <Button type="button" variant="secondary" disabled={pending} onClick={handleComplete}>
        {pending ? 'Saving…' : 'Mark complete'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
