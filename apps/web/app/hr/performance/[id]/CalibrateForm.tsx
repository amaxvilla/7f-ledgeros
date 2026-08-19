'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { calibrateReview, completeReview } from '../actions';

export function CalibrateForm({ reviewId, hasCalibratedRating }: { reviewId: string; hasCalibratedRating: boolean }) {
  const [rating, setRating] = React.useState('');
  const [pending, setPending] = React.useState<'calibrate' | 'complete' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCalibrate(e: React.FormEvent) {
    e.preventDefault();
    setPending('calibrate');
    setError(null);
    const result = await calibrateReview(reviewId, Number(rating));
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to calibrate review.');
  }

  async function handleComplete() {
    setPending('complete');
    setError(null);
    const result = await completeReview(reviewId);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to complete review.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
      <form onSubmit={handleCalibrate} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
        <TextField label="Calibrated rating (1-5)" type="number" value={rating} onChange={(e) => setRating(e.target.value)} required style={{ minWidth: '180px' }} />
        <Button type="submit" disabled={pending !== null}>
          {pending === 'calibrate' ? 'Saving…' : 'Set calibrated rating'}
        </Button>
      </form>
      {hasCalibratedRating && (
        <Button type="button" disabled={pending !== null} onClick={handleComplete}>
          {pending === 'complete' ? 'Completing…' : 'Mark review completed'}
        </Button>
      )}
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </div>
  );
}
