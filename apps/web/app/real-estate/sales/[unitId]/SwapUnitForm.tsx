'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { swapUnitAllocation } from './actions';

/**
 * Frontend Completion, FE-4.11 — Swap Unit, the other half of the last
 * remaining pair FE-4.10's own report named. `SwapUnitDto` (read
 * directly — the class is `SwapUnitDto`, not `SwapAllocationDto` as
 * FE-4.10's own report's prose guessed; confirmed against the actual
 * source rather than trusted) is `{ newUnitId: string; reason: string }`.
 *
 * `newUnitId` is a real `Select`, but fed by a picker THIS PAGE builds
 * itself, not an existing endpoint the way `accountOptions`/
 * `customerOptions` are: `RealEstateService.swapUnitAllocation` places
 * no project restriction on the target unit at all (confirmed directly
 * — any `AVAILABLE` unit anywhere qualifies), but there is no
 * "available units across all projects" endpoint on this backend to
 * build a picker from. This page already fetches the CURRENT unit's own
 * project tree (`GET /dimensions/projects/:projectId/tree`, for
 * locating the current unit itself) — `page.tsx`'s own `loadUnitDetail`
 * now also flattens that same tree into every OTHER `AVAILABLE` unit
 * within it (excluding the current unit) for this picker, a genuine,
 * deliberate UI-level narrowing to "available units in this same
 * project" rather than the backend's own broader "any project"
 * allowance — worth stating plainly rather than implying this picker
 * covers every unit the backend would actually accept. A cross-project
 * picker would need a new "available units across all projects"
 * endpoint that doesn't exist yet; out of scope for this checkpoint.
 */
export function SwapUnitForm({
  unitId,
  allocationId,
  unitOptions,
}: {
  unitId: string;
  allocationId: string;
  unitOptions: SelectOption[];
}) {
  const [newUnitId, setNewUnitId] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await swapUnitAllocation(unitId, allocationId, newUnitId, reason);

    setPending(false);
    if (result.ok) {
      setNewUnitId('');
      setReason('');
    } else {
      setError(result.error ?? 'Failed to swap unit allocation.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
      <Select
        label="New unit"
        value={newUnitId}
        onChange={(e) => setNewUnitId(e.target.value)}
        options={unitOptions}
        placeholder={unitOptions.length === 0 ? 'No other available units in this project' : 'Select a unit…'}
        required
        disabled={unitOptions.length === 0}
        style={{ minWidth: '220px' }}
      />
      <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required style={{ minWidth: '260px' }} />
      <Button type="submit" variant="secondary" disabled={pending || unitOptions.length === 0}>
        {pending ? 'Swapping…' : 'Swap unit'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
