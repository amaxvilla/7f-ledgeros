import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createStockItemMock = vi.fn();
vi.mock('../actions', () => ({
  createStockItem: (...args: unknown[]) => createStockItemMock(...args),
}));

import { CreateStockItemForm } from '../CreateStockItemForm';

beforeEach(() => {
  createStockItemMock.mockReset();
});

describe('CreateStockItemForm', () => {
  it('renders every field', () => {
    render(<CreateStockItemForm entityId="ent-1" />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Domain')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit of measure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add stock item' })).toBeInTheDocument();
  });

  it('submits entityId and the entered values to createStockItem', async () => {
    createStockItemMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateStockItemForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'SI-001');
    await user.type(screen.getByLabelText('Name'), 'Portland Cement 50kg');
    await user.selectOptions(screen.getByLabelText('Domain'), 'CONSTRUCTION_MATERIALS');
    await user.type(screen.getByLabelText('Unit of measure'), 'bag');
    await user.click(screen.getByRole('button', { name: 'Add stock item' }));

    expect(createStockItemMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      code: 'SI-001',
      name: 'Portland Cement 50kg',
      domain: 'CONSTRUCTION_MATERIALS',
      unitOfMeasure: 'bag',
    });
  });

  it('shows an error message when the action fails', async () => {
    createStockItemMock.mockResolvedValue({ ok: false, error: 'Stock item code already exists.' });
    const user = userEvent.setup();
    render(<CreateStockItemForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'SI-001');
    await user.type(screen.getByLabelText('Name'), 'Portland Cement 50kg');
    await user.selectOptions(screen.getByLabelText('Domain'), 'CONSTRUCTION_MATERIALS');
    await user.type(screen.getByLabelText('Unit of measure'), 'bag');
    await user.click(screen.getByRole('button', { name: 'Add stock item' }));

    expect(await screen.findByText('Stock item code already exists.')).toBeInTheDocument();
  });
});
