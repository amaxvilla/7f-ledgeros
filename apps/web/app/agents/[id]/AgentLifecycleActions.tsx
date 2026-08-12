'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { approveAgent, suspendAgent, reactivateAgent, terminateAgent } from '../actions';

type AgentStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

/**
 * Mirrors `PlotReleaseActions.tsx`'s own shape: one component handling
 * every side of a single record's lifecycle, rendering only the
 * action(s) valid from the CURRENT status — matching `AgentService`'s
 * own guarded transitions exactly (confirmed directly): PENDING_APPROVAL
 * -> ACTIVE (Approve, no reason), ACTIVE -> SUSPENDED (Suspend, reason
 * required), SUSPENDED -> ACTIVE (Reactivate, no reason), and
 * TERMINATED (Terminate, reason required) from any of the other three.
 * TERMINATED itself renders no action at all — terminal, no method
 * transitions an agent out of it (confirmed directly in
 * `AgentService.terminate`'s own doc comment).
 */
export function AgentLifecycleActions({ agentId, status }: { agentId: string; status: AgentStatus }) {
  const [suspendReason, setSuspendReason] = React.useState('');
  const [terminateReason, setTerminateReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) setError(result.error ?? fallback);
  }

  if (status === 'TERMINATED') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Terminated — terminal, no further transitions.</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
      <div style={{ display: 'flex', gap: tokens.space(3), flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {status === 'PENDING_APPROVAL' && (
          <Button type="button" disabled={pending} onClick={() => run(() => approveAgent(agentId), 'Failed to approve agent.')}>
            {pending ? 'Approving…' : 'Approve'}
          </Button>
        )}

        {status === 'ACTIVE' && (
          <>
            <TextField label="Suspend reason" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} style={{ minWidth: '220px' }} />
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !suspendReason.trim()}
              onClick={() => run(() => suspendAgent(agentId, suspendReason.trim()), 'Failed to suspend agent.')}
            >
              {pending ? 'Suspending…' : 'Suspend'}
            </Button>
          </>
        )}

        {status === 'SUSPENDED' && (
          <Button type="button" disabled={pending} onClick={() => run(() => reactivateAgent(agentId), 'Failed to reactivate agent.')}>
            {pending ? 'Reactivating…' : 'Reactivate'}
          </Button>
        )}

        <TextField label="Terminate reason" value={terminateReason} onChange={(e) => setTerminateReason(e.target.value)} style={{ minWidth: '220px' }} />
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !terminateReason.trim()}
          onClick={() => run(() => terminateAgent(agentId, terminateReason.trim()), 'Failed to terminate agent.')}
        >
          {pending ? 'Terminating…' : 'Terminate'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
