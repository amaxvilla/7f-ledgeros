import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getStockBalanceMock = vi.fn();
vi.mock('../actions', () => ({
  getStockBalance: (...args: unknown[]) => getStockBalanceMock(...args),
}));

import { StockBalanceLookup } from '../StockBalanceLookup';

const STOCK_ITEM_OPTIONS = [{ value: 'item-1', label: 'SI-001 — Portland Cement 50kg' }];
const WAREHOUSE_OPTIONS = [{ value: 'wh-1', label: 'WH-001 — Main Site Store' }];

beforeEach(() => {
  getStockBalanceMock.mockReset();
});

describe('StockBalanceLookup', () => {
  it('renders both selects and the check button', () => {
    render(<StockBalanceLookup stockItemOptions={STOCK_ITEM_OPTIONS} warehouseOptions={WAREHOUSE_OPTIONS} />);

    expect(screen.getByLabelText('Stock item')).toBeInTheDocument();
    expect(screen.getByLabelText('Warehouse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check balance' })).toBeInTheDocument();
  });

  it('calls getStockBalance with the selected ids and renders the result', async () => {
    getStockBalanceMock.mockResolvedValue({
      ok: true,
      balance: { stockItemId: 'item-1', warehouseId: 'wh-1', quantityOnHand: '120', averageUnitCost: '5.50', totalValue: '660.00' },
    });
    const user = userEvent.setup();
    render(<StockBalanceLookup stockItemOptions={STOCK_ITEM_OPTIONS} warehouseOptions={WAREHOUSE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Stock item'), 'item-1');
    await user.selectOptions(screen.getByLabelText('Warehouse'), 'wh-1');
    await user.click(screen.getByRole('button', { name: 'Check balance' }));

    expect(getStockBalanceMock).toHaveBeenCalledWith('item-1', 'wh-1');
    expect(await screen.findByText('120')).toBeInTheDocument();
    expect(screen.getByText('660.00')).toBeInTheDocument();
  });

  it('shows a "no balance" message when the lookup returns null', async () => {
    getStockBalanceMock.mockResolvedValue({ ok: true, balance: null });
    const user = userEvent.setup();
    render(<StockBalanceLookup stockItemOptions={STOCK_ITEM_OPTIONS} warehouseOptions={WAREHOUSE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Stock item'), 'item-1');
    await user.selectOptions(screen.getByLabelText('Warehouse'), 'wh-1');
    await user.click(screen.getByRole('button', { name: 'Check balance' }));

    expect(await screen.findByText('No balance recorded yet for this item and warehouse.')).toBeInTheDocument();
  });

  it('shows an error message when the lookup fails', async () => {
    getStockBalanceMock.mockResolvedValue({ ok: false, error: 'Failed to look up stock balance.' });
    const user = userEvent.setup();
    render(<StockBalanceLookup stockItemOptions={STOCK_ITEM_OPTIONS} warehouseOptions={WAREHOUSE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Stock item'), 'item-1');
    await user.selectOptions(screen.getByLabelText('Warehouse'), 'wh-1');
    await user.click(screen.getByRole('button', { name: 'Check balance' }));

    expect(await screen.findByText('Failed to look up stock balance.')).toBeInTheDocument();
  });
});
