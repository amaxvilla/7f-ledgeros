'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { submitManagerReview } from '../actions';

export function ManagerReviewForm({ reviewId }: { reviewId: string }) {
  const [managerRating, setManagerRating] = React.useState('');
  const [managerComments, setManagerComments] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await submitManagerReview(reviewId, {
      managerRating: Number(managerRating),
      managerComments: managerComments || undefined,
    });
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to submit manager review.');
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
      <TextField label="Manager rating (1-5)" type="number" value={managerRating} onChange={(e) => setManagerRating(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="Comments (optional)" value={managerComments} onChange={(e) => setManagerComments(e.target.value)} style={{ minWidth: '260px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit manager review'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
