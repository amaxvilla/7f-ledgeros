import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const transferAllocationMock = vi.fn();
vi.mock('../actions', () => ({
  transferAllocation: (...args: unknown[]) => transferAllocationMock(...args),
}));

import { TransferAllocationForm } from '../TransferAllocationForm';

const CUSTOMER_OPTIONS = [
  { value: 'cust-1', label: 'CUST-001 — Amaka Okafor' },
  { value: 'cust-2', label: 'CUST-002 — Tunde Balogun' },
];

beforeEach(() => {
  transferAllocationMock.mockReset();
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('New customer'), 'cust-2');
  await user.type(screen.getByLabelText('Reason'), 'Original buyer requested reassignment');
}

describe('TransferAllocationForm', () => {
  it('renders every field with its label', () => {
    render(<TransferAllocationForm unitId="unit-1" allocationId="alloc-1" customerOptions={CUSTOMER_OPTIONS} />);

    expect(screen.getByLabelText('New customer')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transfer allocation' })).toBeInTheDocument();
  });

  it('populates the customer Select from the customerOptions prop', () => {
    render(<TransferAllocationForm unitId="unit-1" allocationId="alloc-1" customerOptions={CUSTOMER_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'CUST-001 — Amaka Okafor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CUST-002 — Tunde Balogun' })).toBeInTheDocument();
  });

  it('marks both fields as required', () => {
    render(<TransferAllocationForm unitId="unit-1" allocationId="alloc-1" customerOptions={CUSTOMER_OPTIONS} />);

    expect(screen.getByLabelText('New customer')).toBeRequired();
    expect(screen.getByLabelText('Reason')).toBeRequired();
  });

  it('submits with the unit/allocation ids, chosen customer, and typed reason', async () => {
    transferAllocationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TransferAllocationForm unitId="unit-1" allocationId="alloc-1" customerOptions={CUSTOMER_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Transfer allocation' }));

    expect(transferAllocationMock).toHaveBeenCalledWith('unit-1', 'alloc-1', 'cust-2', 'Original buyer requested reassignment');
  });

  it('shows the action-returned error message on failure', async () => {
    transferAllocationMock.mockResolvedValue({ ok: false, error: 'Cannot transfer an allocation with status SOLD' });
    const user = userEvent.setup();
    render(<TransferAllocationForm unitId="unit-1" allocationId="alloc-1" customerOptions={CUSTOMER_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Transfer allocation' }));

    expect(await screen.findByText('Cannot transfer an allocation with status SOLD')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    transferAllocationMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<TransferAllocationForm unitId="unit-1" allocationId="alloc-1" customerOptions={CUSTOMER_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Transfer allocation' }));

    expect(await screen.findByText('Failed to transfer allocation.')).toBeInTheDocument();
  });

  it('resets both fields after a successful submit', async () => {
    transferAllocationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TransferAllocationForm unitId="unit-1" allocationId="alloc-1" customerOptions={CUSTOMER_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Transfer allocation' }));

    expect(await screen.findByLabelText('New customer')).toHaveValue('');
    expect(screen.getByLabelText('Reason')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    transferAllocationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TransferAllocationForm unitId="unit-1" allocationId="alloc-1" customerOptions={CUSTOMER_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Transfer allocation' }));

    expect(screen.getByRole('button', { name: 'Transferring…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Transfer allocation' })).not.toBeDisabled();
  });
});
