'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { startOnboarding } from '../actions';

export function StartOnboardingButton({ id, hasTasks }: { id: string; hasTasks: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (hasTasks) return null;

  async function handleStart() {
    setPending(true);
    setError(null);
    const result = await startOnboarding(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? 'Failed to start onboarding.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
      <Button type="button" variant="secondary" disabled={pending} onClick={handleStart}>
        {pending ? 'Starting…' : 'Start onboarding checklist'}
      </Button>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
