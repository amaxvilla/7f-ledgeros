import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const approvePurchaseOrderMock = vi.fn();
const rejectPurchaseOrderMock = vi.fn();

vi.mock('../actions', () => ({
  approvePurchaseOrder: (...args: unknown[]) => approvePurchaseOrderMock(...args),
  rejectPurchaseOrder: (...args: unknown[]) => rejectPurchaseOrderMock(...args),
}));

import { PurchaseOrderStatusActions } from '../PurchaseOrderStatusActions';

beforeEach(() => {
  approvePurchaseOrderMock.mockReset();
  rejectPurchaseOrderMock.mockReset();
});

describe('PurchaseOrderStatusActions', () => {
  it('shows "Approve" and "Reject" for a DRAFT purchase order', () => {
    render(<PurchaseOrderStatusActions id="po-1" status="DRAFT" />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows a dash for an APPROVED purchase order', () => {
    render(<PurchaseOrderStatusActions id="po-1" status="APPROVED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows a dash for a CANCELLED purchase order', () => {
    render(<PurchaseOrderStatusActions id="po-1" status="CANCELLED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls approvePurchaseOrder when "Approve" is clicked', async () => {
    approvePurchaseOrderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PurchaseOrderStatusActions id="po-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(approvePurchaseOrderMock).toHaveBeenCalledWith('po-42');
  });

  it('calls rejectPurchaseOrder when "Reject" is clicked', async () => {
    rejectPurchaseOrderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PurchaseOrderStatusActions id="po-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(rejectPurchaseOrderMock).toHaveBeenCalledWith('po-42');
  });

  it('shows an error message when an action fails', async () => {
    approvePurchaseOrderMock.mockResolvedValue({ ok: false, error: 'Failed to approve purchase order.' });
    const user = userEvent.setup();
    render(<PurchaseOrderStatusActions id="po-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Failed to approve purchase order.')).toBeInTheDocument();
  });
});
