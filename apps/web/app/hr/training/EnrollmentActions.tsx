'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { markAttended, cancelEnrollment, evaluateTraining } from './actions';

type Action = 'attended' | 'cancel' | 'evaluate';

/**
 * ENROLLED branches two ways (mark attended OR cancel, both
 * `hr.manage`) — same non-linear shape every other status-actions
 * component in this codebase uses for a real branch point. ATTENDED
 * can only move forward to evaluation (`evaluateTraining` itself
 * rejects any enrollment not already ATTENDED, so no separate "cancel
 * after attended" path is offered here). NO_SHOW/CANCELLED are
 * terminal; an evaluated enrollment (rating present) is also shown as
 * terminal, since `evaluateTraining` has no re-evaluate guard but
 * offering to silently overwrite a recorded evaluation isn't a
 * behavior this frontend should invent unprompted.
 */
export function EnrollmentActions({
  id,
  status,
  evaluationRating,
}: {
  id: string;
  status: string;
  evaluationRating: number | null;
}) {
  const [pending, setPending] = React.useState<Action | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [evaluating, setEvaluating] = React.useState(false);
  const [rating, setRating] = React.useState('');
  const [comments, setComments] = React.useState('');

  async function handleAttended() {
    setPending('attended');
    setError(null);
    const result = await markAttended(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to mark attended.');
  }

  async function handleCancel() {
    setPending('cancel');
    setError(null);
    const result = await cancelEnrollment(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to cancel enrollment.');
  }

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    setPending('evaluate');
    setError(null);
    const result = await evaluateTraining(id, { evaluationRating: Number(rating), evaluationComments: comments || undefined });
    setPending(null);
    if (result.ok) {
      setEvaluating(false);
    } else {
      setError(result.error ?? 'Failed to record evaluation.');
    }
  }

  if (status === 'ENROLLED') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: tokens.space(2) }}>
          <Button type="button" disabled={pending !== null} onClick={handleAttended}>
            {pending === 'attended' ? 'Saving…' : 'Mark attended'}
          </Button>
          <Button type="button" variant="secondary" disabled={pending !== null} onClick={handleCancel}>
            {pending === 'cancel' ? 'Cancelling…' : 'Cancel'}
          </Button>
        </div>
        {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
      </div>
    );
  }

  if (status === 'ATTENDED' && evaluationRating == null) {
    if (evaluating) {
      return (
        <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2), alignItems: 'flex-end', minWidth: '220px' }}>
          <TextField label="Rating (1-5)" type="number" value={rating} onChange={(e) => setRating(e.target.value)} required style={{ width: '100%' }} />
          <TextField label="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: tokens.space(2) }}>
            <Button type="submit" disabled={pending !== null}>
              {pending === 'evaluate' ? 'Saving…' : 'Save evaluation'}
            </Button>
            <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => setEvaluating(false)}>
              Back
            </Button>
          </div>
          {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
        </form>
      );
    }

    return (
      <Button type="button" variant="secondary" onClick={() => setEvaluating(true)}>
        Evaluate
      </Button>
    );
  }

  return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
}
