'use client';

import * as React from 'react';
import { tokens } from '@7f/ui';

/**
 * Real accessibility defect fixed here: the `<label>` and `<input>`
 * below had no `htmlFor`/`id` association at all — confirmed directly
 * by a failing `getByLabelText` query, the same failure mode a screen
 * reader's own label lookup would hit, not a test-only artifact.
 * `React.useId()` (a React 18 built-in) generates a stable, unique id
 * per mounted instance — the same pattern `packages/ui/src/components/Form.tsx`'s
 * own `TextField`/`Select` already use internally, confirmed by reading
 * before applying it here, so this matches an established convention
 * rather than inventing a new one.
 */
export function EntitySelector({ initialValue }: { initialValue?: string }) {
  const [value, setValue] = React.useState(initialValue ?? '');
  const inputId = React.useId();

  return (
    <form
      method="GET"
      style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', marginBottom: tokens.space(6) }}
    >
      <label htmlFor={inputId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
        Entity ID
      </label>
      <input
        id={inputId}
        name="entityId"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 3fae0c9e-..."
        style={{
          background: tokens.color.surfaceRaised,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.sm,
          color: tokens.color.textPrimary,
          padding: `${tokens.space(2)} ${tokens.space(3)}`,
          fontFamily: tokens.font.mono,
          fontSize: '13px',
          minWidth: '320px',
        }}
      />
      <button
        type="submit"
        style={{
          background: tokens.color.accent,
          color: tokens.color.bg,
          border: 'none',
          borderRadius: tokens.radius.sm,
          padding: `${tokens.space(2)} ${tokens.space(4)}`,
          fontFamily: tokens.font.body,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        View
      </button>
    </form>
  );
}
