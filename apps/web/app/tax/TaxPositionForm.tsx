'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';

/**
 * Frontend Completion — the first date-range QUERY form in this app,
 * distinct in kind from CreateTenantForm/CreateLeadForm/CreateTaxCodeForm/
 * CreateFixedAssetForm/CreateLeaseForm: those five all POST through a
 * 'use server' Server Action because only the server can attach this
 * app's API bearer token (see any of their own doc comments). A GET
 * query needs no such thing — `GET /tax/position` takes plain query
 * params, so this form is a native `<form method="GET">` submitting
 * straight to `/tax` with entityId/periodStart/periodEnd as URL search
 * params, causing TaxPage's own Server Component to re-render with the
 * new params and fetch accordingly. Same mechanism EntitySelector
 * already uses for its own entityId param — this form just adds two
 * more fields to the same idea, which is exactly the "date-range-input
 * pattern" tax/page.tsx's own Checkpoint M doc comment said was
 * missing.
 *
 * Still 'use client' + controlled useState, matching EntitySelector's
 * own posture, not because a GET form requires it (an uncontrolled form
 * with defaultValue would work identically) but for visual/behavioral
 * consistency with the one other query-style form already in this app.
 */
export function TaxPositionForm({
  entityId,
  periodStart,
  periodEnd,
}: {
  entityId: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  const [start, setStart] = React.useState(periodStart ?? '');
  const [end, setEnd] = React.useState(periodEnd ?? '');

  return (
    <form
      method="get"
      action="/tax"
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
      {/* entityId must round-trip through this form too, or submitting it would drop the entity filter the rest of the page depends on. */}
      <input type="hidden" name="entityId" value={entityId} />
      <TextField label="Period start" type="date" name="periodStart" value={start} onChange={(e) => setStart(e.target.value)} required />
      <TextField label="Period end" type="date" name="periodEnd" value={end} onChange={(e) => setEnd(e.target.value)} required />
      <Button type="submit">View tax position</Button>
    </form>
  );
}
