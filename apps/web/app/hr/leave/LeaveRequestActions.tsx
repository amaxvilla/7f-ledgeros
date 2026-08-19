'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { approveLeaveRequest, rejectLeaveRequest, cancelLeaveRequest } from './actions';

type Action = 'approve' | 'reject' | 'cancel';

/**
 * SUBMITTED branches two ways (approve OR reject, both `hr.manage`) —
 * same non-linear shape `JournalEntryStatusActions`' own
 * `PENDING_APPROVAL` branch already established, reused here rather
 * than re-deriving. DRAFT can only be cancelled (never submitted
 * through this UI — `requestLeave` itself creates SUBMITTED directly,
 * so DRAFT is a state this frontend never produces but the backend
 * still allows cancelling out of, same as any pre-existing DRAFT row
 * created another way). APPROVED/REJECTED/CANCELLED are all terminal.
 */
export function LeaveRequestActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState<Action | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState('');

  async function handleApprove() {
    setPending('approve');
    setError(null);
    const result = await approveLeaveRequest(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to approve.');
  }

  async function handleReject() {
    setPending('reject');
    setError(null);
    const result = await rejectLeaveRequest(id, rejectionReason);
    setPending(null);
    if (result.ok) {
      setRejecting(false);
      setRejectionReason('');
    } else {
      setError(result.error ?? 'Failed to reject.');
    }
  }

  async function handleCancel() {
    setPending('cancel');
    setError(null);
    const result = await cancelLeaveRequest(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to cancel.');
  }

  if (status === 'DRAFT') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <Button type="button" variant="secondary" disabled={pending !== null} onClick={handleCancel}>
          {pending === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </Button>
        {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
      </div>
    );
  }

  if (status === 'SUBMITTED') {
    if (rejecting) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2), alignItems: 'flex-end', minWidth: '200px' }}>
          <TextField
            label="Rejection reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: tokens.space(2) }}>
            <Button type="button" disabled={pending !== null || !rejectionReason} onClick={handleReject}>
              {pending === 'reject' ? 'Rejecting…' : 'Confirm reject'}
            </Button>
            <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => setRejecting(false)}>
              Back
            </Button>
          </div>
          {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: tokens.space(2) }}>
          <Button type="button" disabled={pending !== null} onClick={handleApprove}>
            {pending === 'approve' ? 'Approving…' : 'Approve'}
          </Button>
          <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
        {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
      </div>
    );
  }

  return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
}
