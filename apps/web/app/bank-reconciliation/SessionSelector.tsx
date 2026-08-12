'use client';

import * as React from 'react';
import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-3.6 — same `method="GET"` shape as
 * `EntitySelector`, but with a hidden `entityId` passthrough field:
 * `EntitySelector`'s own form only submits its own named input, so
 * without this hidden field, submitting a session id here would drop
 * `entityId` from the URL and this page's entity-gated sections would
 * lose their value. This is the id-entry pattern this checkpoint's own
 * `page.tsx` doc comment refers to — the equivalent of a `DataTable`
 * row-click for a resource with no list endpoint to click a row from at
 * all.
 *
 * `htmlFor`/`id` (via `React.useId()`) added to associate the label
 * with its input — the same real accessibility defect, and the same
 * fix, applied to `EntitySelector.tsx` (see its own doc comment).
 */
export function SessionSelector({ entityId, initialValue }: { entityId?: string; initialValue?: string }) {
  const [value, setValue] = React.useState(initialValue ?? '');
  const inputId = React.useId();

  return (
    <form
      method="GET"
      style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', marginBottom: tokens.space(6) }}
    >
      {entityId && <input type="hidden" name="entityId" value={entityId} />}
      <label htmlFor={inputId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
        Session ID
      </label>
      <input
        id={inputId}
        name="sessionId"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 9f2c1a4e-..."
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
        Work session
      </button>
    </form>
  );
}
