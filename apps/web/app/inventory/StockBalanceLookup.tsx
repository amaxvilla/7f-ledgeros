'use client';

import * as React from 'react';
import { Button, Select, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { getStockBalance } from './actions';
import type { StockBalance } from './actions';

/**
 * Frontend Completion, FE-3.4 — the first read-only lookup in this
 * codebase's own module pages: every other `'use server'` action so
 * far (see `actions.ts`'s own doc comment) creates or mutates something
 * and returns `{ ok, error }`; `getStockBalance` returns the fetched
 * `StockBalance | null` itself on success, since there's a result for
 * this component to render rather than just a pass/fail. `GET
 * /inventory/balance` has no list form at all (`getBalance` requires
 * both `stockItemId` and `warehouseId`, confirmed directly) — this
 * component is the on-demand, one-record equivalent of the tables the
 * rest of this page uses for its two list-able resources.
 *
 * A `null` result (the `StockBalance` composite-key row simply doesn't
 * exist yet for that item/warehouse pair — no goods receipt has ever
 * posted against it) is rendered as "No balance recorded yet" rather
 * than treated as an error; only a thrown `ApiError` renders as one.
 *
 * ADDENDUM (Mobile Responsiveness, page-level layout audit) — the
 * three-stat result row (`Quantity on hand`/`Average unit cost`/`Total
 * value`) gained `flexWrap: 'wrap'`: a genuine, confirmed finding
 * (unlike most of this audit, which found the app's shared primitives
 * and grid layouts already responsive) — three labeled text spans with
 * a fixed `gap: space(6)` (24px) and no wrap would crowd or cramp on a
 * narrow viewport. No test added — this component's own test file
 * asserts behavior (values rendered, lookup called), not inline style,
 * the same distinction this app's history draws between shared
 * `packages/ui` primitives (style-tested, since one change affects
 * every page) and page-local components like this one (not
 * style-tested).
 */
export function StockBalanceLookup({ stockItemOptions, warehouseOptions }: { stockItemOptions: SelectOption[]; warehouseOptions: SelectOption[] }) {
  const [stockItemId, setStockItemId] = React.useState('');
  const [warehouseId, setWarehouseId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [balance, setBalance] = React.useState<StockBalance | null | undefined>(undefined);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setBalance(undefined);

    const result = await getStockBalance(stockItemId, warehouseId);

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to look up stock balance.');
      return;
    }
    setBalance(result.balance ?? null);
  }

  return (
    <form
      onSubmit={handleLookup}
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
      <Select
        label="Stock item"
        value={stockItemId}
        onChange={(e) => setStockItemId(e.target.value)}
        options={stockItemOptions}
        placeholder="Select a stock item…"
        required
        style={{ minWidth: '220px' }}
      />
      <Select
        label="Warehouse"
        value={warehouseId}
        onChange={(e) => setWarehouseId(e.target.value)}
        options={warehouseOptions}
        placeholder="Select a warehouse…"
        required
        style={{ minWidth: '200px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Check balance'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {balance === null && (
        <div style={{ width: '100%', fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          No balance recorded yet for this item and warehouse.
        </div>
      )}
      {balance && (
        <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: tokens.space(6), fontFamily: tokens.font.body, fontSize: '13px' }}>
          <span>Quantity on hand: <strong>{balance.quantityOnHand}</strong></span>
          <span>Average unit cost: <strong>{balance.averageUnitCost}</strong></span>
          <span>Total value: <strong>{balance.totalValue}</strong></span>
        </div>
      )}
    </form>
  );
}
