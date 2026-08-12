'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { updateTaskProgress, setTaskStatus } from './actions';

const STATUS_OPTIONS = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];

/**
 * Frontend Completion, FE-5.1 — two independent controls in one cell,
 * not a single status-driven branch like `JournalEntryStatusActions`:
 * `updateProgress` and `setStatus` are genuinely separate endpoints
 * with different semantics (see `actions.ts`'s own doc comment), so
 * this component always renders both rather than picking one based on
 * current status. A `CANCELLED` task disables the progress control
 * only (`updateProgress`'s own `ConflictException` guard, confirmed
 * directly) — `setStatus` has no such guard, so it stays enabled even
 * on a cancelled task (e.g. to move it back to `NOT_STARTED`).
 *
 * The status control is a plain native `<select>`, not `@7f/ui`'s own
 * `Select` — same reasoning `ProjectSelector`'s own doc comment gives:
 * this one's paired with a plain button in a tight inline row, not a
 * padded form field, and there's no `SelectOption[]` registry to build
 * (`ProjectTaskStatus` is a fixed five-value enum, inlined directly).
 *
 * ADDENDUM (Mobile Responsiveness rollout) — both `Button`s' own
 * compact `style` override removed (% complete, Set status), each now
 * rendering at `Button`'s own properly-sized default touch target.
 * Correctly identified as still-unfixed by a fresh whole-app sweep
 * rather than by trusting `CHECKPOINT_REPORT.md`'s own top entry —
 * that report was confirmed stale (a sibling recommended file in the
 * same batch, `GenerateCertificateForm.tsx`, was already fixed under a
 * later, unreported checkpoint number). The plain native `<input
 * type="number">` and `<select>` elsewhere in this component are
 * untouched — out of this rollout's own `@7f/ui`-component-only scope
 * (they were never `Button`/`TextField`/`Select` to begin with).
 */
export function TaskActions({ id, status }: { id: string; status: string }) {
  const [percentComplete, setPercentComplete] = React.useState('0');
  const [nextStatus, setNextStatus] = React.useState(status);
  const [pending, setPending] = React.useState<'progress' | 'status' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleUpdateProgress() {
    setPending('progress');
    setError(null);
    const result = await updateTaskProgress(id, { percentComplete: Number(percentComplete) });
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to update task progress.');
  }

  async function handleSetStatus() {
    setPending('status');
    setError(null);
    const result = await setTaskStatus(id, nextStatus);
    setPending(null);
    if (!result.ok) setError(result.error ?? 'Failed to set task status.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2), alignItems: 'flex-end', minWidth: '220px' }}>
      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center' }}>
        <input
          type="number"
          min={0}
          max={100}
          value={percentComplete}
          onChange={(e) => setPercentComplete(e.target.value)}
          disabled={status === 'CANCELLED' || pending !== null}
          style={{
            width: '64px',
            background: tokens.color.surfaceRaised,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.sm,
            color: tokens.color.textPrimary,
            padding: `${tokens.space(1)} ${tokens.space(2)}`,
            fontFamily: tokens.font.body,
            fontSize: '12px',
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={status === 'CANCELLED' || pending !== null}
          onClick={handleUpdateProgress}
        >
          {pending === 'progress' ? 'Updating…' : '% complete'}
        </Button>
      </div>
      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center' }}>
        <select
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
          disabled={pending !== null}
          style={{
            background: tokens.color.surfaceRaised,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.sm,
            color: tokens.color.textPrimary,
            padding: `${tokens.space(1)} ${tokens.space(2)}`,
            fontFamily: tokens.font.body,
            fontSize: '12px',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={handleSetStatus}
        >
          {pending === 'status' ? 'Setting…' : 'Set status'}
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </div>
  );
}
