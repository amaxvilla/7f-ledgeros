'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { addPeerFeedback } from '../actions';

export function PeerFeedbackForm({ reviewId }: { reviewId: string }) {
  const [comments, setComments] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comments.trim()) return;
    setPending(true);
    setError(null);
    const result = await addPeerFeedback(reviewId, comments);
    setPending(false);
    if (result.ok) {
      setComments('');
    } else {
      setError(result.error ?? 'Failed to add peer feedback.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
      <TextField label="Peer feedback" value={comments} onChange={(e) => setComments(e.target.value)} required style={{ minWidth: '320px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add feedback'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
