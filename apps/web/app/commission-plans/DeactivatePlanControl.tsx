'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { deactivateCommissionPlan } from './actions';

/**
 * Row-level lifecycle control. Only ACTIVE plans render anything — see
 * CommissionPlanStatus's own schema doc comment for why there is no
 * reactivation path (create a new plan instead), mirroring
 * `AgentLifecycleActions`'s own "TERMINATED renders nothing" pattern
 * for a genuinely terminal state.
 */
export function DeactivatePlanControl({ planId, status }: { planId: string; status: 'ACTIVE' | 'INACTIVE' }) {
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status !== 'ACTIVE') {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>Inactive</span>;
  }

  async function handleDeactivate() {
    setPending(true);
    setError(null);
    const result = await deactivateCommissionPlan(planId, reason.trim());
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to deactivate plan.');
  }

  return (
    <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        label=""
        placeholder="Deactivation reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Button type="button" variant="secondary" disabled={pending || !reason.trim()} onClick={handleDeactivate}>
        {pending ? 'Deactivating…' : 'Deactivate'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
