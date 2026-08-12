'use client';

import * as React from 'react';
import { tokens } from '@7f/ui';

export interface AgentOption {
  id: string;
  code: string;
  displayName: string;
}

/**
 * Same GET-form-navigates shape `ProjectSelector`/`EntitySelector`
 * already established (see `ProjectSelector`'s own doc comment for why
 * this app has no client-side-fetch filter pattern) — a plain
 * `<select>`, not `@7f/ui`'s `Select`, since the browser itself needs
 * to read this field's `name`/`value` at native form submit time.
 * `entityId` is carried forward as a hidden field so switching agents
 * never drops the page's current entity scope.
 */
export function AgentSelector({
  entityId,
  agentOptions,
  initialValue,
}: {
  entityId: string;
  agentOptions: AgentOption[];
  initialValue?: string;
}) {
  const [value, setValue] = React.useState(initialValue ?? '');
  const selectId = React.useId();

  return (
    <form method="GET" style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', marginBottom: tokens.space(4), flexWrap: 'wrap' }}>
      <input type="hidden" name="entityId" value={entityId} />
      <label htmlFor={selectId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
        Agent
      </label>
      <select
        id={selectId}
        name="agentId"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          background: tokens.color.surfaceRaised,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.sm,
          color: tokens.color.textPrimary,
          padding: `${tokens.space(2)} ${tokens.space(3)}`,
          fontFamily: tokens.font.body,
          fontSize: '13px',
          minWidth: '280px',
        }}
      >
        <option value="">Select an agent…</option>
        {agentOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.displayName}
          </option>
        ))}
      </select>
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
        View history
      </button>
    </form>
  );
}
