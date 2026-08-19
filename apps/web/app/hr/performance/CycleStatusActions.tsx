'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { startCalibration, closeCycle } from './actions';

type Action = 'calibrate' | 'close';

export function CycleStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState<Action | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(action: Action, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setPending(action);
    setError(null);
    const result = await fn(id);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to update cycle.');
  }

  let button: React.ReactNode = null;
  if (status === 'OPEN') {
    button = (
      <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => run('calibrate', startCalibration)}>
        {pending === 'calibrate' ? 'Starting…' : 'Start calibration'}
      </Button>
    );
  } else if (status === 'CALIBRATION') {
    button = (
      <Button type="button" disabled={pending !== null} onClick={() => run('close', closeCycle)}>
        {pending === 'close' ? 'Closing…' : 'Close cycle'}
      </Button>
    );
  }

  if (!button) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), alignItems: 'flex-end' }}>
      {button}
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
