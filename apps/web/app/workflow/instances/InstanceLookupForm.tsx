'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-8.7 — Workflow Instances. See
 * `instances/page.tsx`'s own doc comment for the full before-coding
 * analysis, including why this had to be a lookup form rather than a
 * plain register table.
 *
 * A native `<form method="GET">`, the same mechanism
 * `tax/TaxPositionForm.tsx` already established for a query (not a
 * mutation) — `GET /workflow/instances` takes plain `entityType`/
 * `entityId` query params, so no Server Action or bearer token is
 * needed here; submitting re-renders `InstancesPage`'s own Server
 * Component with the new `searchParams`. Still `'use client'` +
 * controlled `useState`, for the same "visual/behavioral consistency
 * with the one other query-style form already in this app" reason
 * `TaxPositionForm`'s own doc comment gives, not because a GET form
 * requires it.
 */
export function InstanceLookupForm({ entityType, entityId }: { entityType?: string; entityId?: string }) {
  const [type, setType] = React.useState(entityType ?? '');
  const [id, setId] = React.useState(entityId ?? '');

  return (
    <form
      method="get"
      action="/workflow/instances"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField
        label="Entity type"
        name="entityType"
        value={type}
        onChange={(e) => setType(e.target.value)}
        required
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Entity ID"
        name="entityId"
        value={id}
        onChange={(e) => setId(e.target.value)}
        required
        style={{ minWidth: '280px' }}
      />
      <Button type="submit">Find instances</Button>
    </form>
  );
}
