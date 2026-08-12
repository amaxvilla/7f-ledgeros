'use client';

import * as React from 'react';
import { Button, tokens, useToast } from '@7f/ui';
import { deactivateEntity } from './actions';

interface SelectableEntity {
  id: string;
  isActive: boolean;
}

/**
 * Frontend Completion, FC-1.4 — this checkpoint's one real, working
 * demonstration of `DataTable`'s new `bulkActions` prop (see
 * `DataTable.tsx`'s own doc comment for why this is a single
 * demonstrated usage, not a sweeping retrofit across every list page).
 * Entities was picked because it already has the exact single-row
 * equivalent (`DeactivateEntityButton`) to extend, not invent — this
 * component calls the SAME `deactivateEntity` action, once per
 * selected, still-active entity, sequentially (not `Promise.all` — a
 * burst of concurrent `DELETE` requests against the same
 * `entity.manage`-guarded endpoint has no established precedent
 * anywhere in this app, and sequential keeps the eventual toast/error
 * message unambiguous about how far it got).
 *
 * Already-inactive entities in the selection are silently skipped
 * (deactivating an inactive entity again is a no-op the person gets no
 * benefit from being warned about) — the summary toast reports how many
 * were actually deactivated, which may be fewer than the selected
 * count. Calls `clearSelection` (passed down as `onDone` by
 * `page.tsx`'s own `renderActions`) only after finishing, successfully
 * or not — a failed run leaves the selection in place so the person can
 * see which rows were involved and retry, rather than losing their
 * selection on a partial failure.
 */
export function BulkDeactivateEntitiesButton({ entities, onDone }: { entities: SelectableEntity[]; onDone: () => void }) {
  const { showToast } = useToast();
  const [pending, setPending] = React.useState(false);

  const activeCount = entities.filter((e) => e.isActive).length;

  async function handleClick() {
    setPending(true);
    let deactivated = 0;
    let failed = 0;

    for (const entity of entities) {
      if (!entity.isActive) continue;
      const result = await deactivateEntity(entity.id);
      if (result.ok) deactivated++;
      else failed++;
    }

    setPending(false);
    if (failed === 0) {
      showToast(`${deactivated} entit${deactivated === 1 ? 'y' : 'ies'} deactivated.`, 'positive');
    } else {
      showToast(`${deactivated} deactivated, ${failed} failed.`, deactivated > 0 ? 'neutral' : 'negative');
    }
    onDone();
  }

  if (activeCount === 0) {
    return <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Selected entities are already inactive.</span>;
  }

  return (
    <Button type="button" variant="secondary" disabled={pending} onClick={handleClick} style={{ padding: `${tokens.space(1)} ${tokens.space(3)}`, fontSize: '13px' }}>
      {pending ? 'Deactivating…' : `Deactivate ${activeCount} selected`}
    </Button>
  );
}
