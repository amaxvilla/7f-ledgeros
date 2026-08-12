import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createPurchaseOrderMock = vi.fn();
vi.mock('../actions', () => ({
  createPurchaseOrder: (...args: unknown[]) => createPurchaseOrderMock(...args),
}));

import { CreatePurchaseOrderForm } from '../CreatePurchaseOrderForm';

const ACCOUNT_OPTIONS = [{ value: 'acct-1', label: '5000-100 — Office supplies' }];
const VENDOR_OPTIONS = [{ value: 'vend-1', label: 'VEND-001 — Acme Building Supplies' }];

beforeEach(() => {
  createPurchaseOrderMock.mockReset();
});

describe('CreatePurchaseOrderForm', () => {
  it('renders the header fields and one line by default', () => {
    render(<CreatePurchaseOrderForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} vendorOptions={VENDOR_OPTIONS} />);

    expect(screen.getByLabelText('PO number')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor')).toBeInTheDocument();
    expect(screen.getByLabelText('Order date')).toBeInTheDocument();
    expect(screen.getByLabelText('Requisition ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget line ID (line 1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('submits entityId, header fields, and lines to createPurchaseOrder', async () => {
    createPurchaseOrderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePurchaseOrderForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} vendorOptions={VENDOR_OPTIONS} />);

    await user.type(screen.getByLabelText('PO number'), 'PO-001');
    await user.selectOptions(screen.getByLabelText('Vendor'), 'vend-1');
    await user.type(screen.getByLabelText('Order date'), '2026-08-01');
    await user.type(screen.getByLabelText('Description (line 1)'), 'Printer paper');
    await user.selectOptions(screen.getByLabelText('Account (line 1)'), 'acct-1');
    await user.type(screen.getByLabelText('Budget line ID (line 1)'), 'bl-1');
    await user.clear(screen.getByLabelText('Quantity (line 1)'));
    await user.type(screen.getByLabelText('Quantity (line 1)'), '10');
    await user.clear(screen.getByLabelText('Unit cost (line 1)'));
    await user.type(screen.getByLabelText('Unit cost (line 1)'), '5');
    await user.click(screen.getByRole('button', { name: 'Create purchase order' }));

    expect(createPurchaseOrderMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      poNumber: 'PO-001',
      vendorId: 'vend-1',
      orderDate: '2026-08-01',
      requisitionId: undefined,
      lines: [{ description: 'Printer paper', accountId: 'acct-1', budgetLineId: 'bl-1', quantity: 10, unitCost: 5 }],
    });
  });

  it('shows an error message when the action fails', async () => {
    createPurchaseOrderMock.mockResolvedValue({ ok: false, error: 'PO number already exists.' });
    const user = userEvent.setup();
    render(<CreatePurchaseOrderForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} vendorOptions={VENDOR_OPTIONS} />);

    await user.type(screen.getByLabelText('PO number'), 'PO-001');
    await user.selectOptions(screen.getByLabelText('Vendor'), 'vend-1');
    await user.type(screen.getByLabelText('Order date'), '2026-08-01');
    await user.type(screen.getByLabelText('Description (line 1)'), 'Printer paper');
    await user.selectOptions(screen.getByLabelText('Account (line 1)'), 'acct-1');
    await user.type(screen.getByLabelText('Budget line ID (line 1)'), 'bl-1');
    await user.click(screen.getByRole('button', { name: 'Create purchase order' }));

    expect(await screen.findByText('PO number already exists.')).toBeInTheDocument();
  });
});
