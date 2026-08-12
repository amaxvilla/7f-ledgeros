import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createWarehouseMock = vi.fn();
vi.mock('../actions', () => ({
  createWarehouse: (...args: unknown[]) => createWarehouseMock(...args),
}));

import { CreateWarehouseForm } from '../CreateWarehouseForm';

beforeEach(() => {
  createWarehouseMock.mockReset();
});

describe('CreateWarehouseForm', () => {
  it('renders every field', () => {
    render(<CreateWarehouseForm entityId="ent-1" />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add warehouse' })).toBeInTheDocument();
  });

  it('submits entityId and the entered values to createWarehouse', async () => {
    createWarehouseMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateWarehouseForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'WH-001');
    await user.type(screen.getByLabelText('Name'), 'Main Site Store');
    await user.click(screen.getByRole('button', { name: 'Add warehouse' }));

    expect(createWarehouseMock).toHaveBeenCalledWith({ entityId: 'ent-1', code: 'WH-001', name: 'Main Site Store' });
  });

  it('shows an error message when the action fails', async () => {
    createWarehouseMock.mockResolvedValue({ ok: false, error: 'Warehouse code already exists.' });
    const user = userEvent.setup();
    render(<CreateWarehouseForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'WH-001');
    await user.type(screen.getByLabelText('Name'), 'Main Site Store');
    await user.click(screen.getByRole('button', { name: 'Add warehouse' }));

    expect(await screen.findByText('Warehouse code already exists.')).toBeInTheDocument();
  });
});
