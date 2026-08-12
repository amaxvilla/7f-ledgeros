import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createLeaseMock = vi.fn();
vi.mock('../actions', () => ({
  createLease: (...args: unknown[]) => createLeaseMock(...args),
}));

import { CreateLeaseForm } from '../CreateLeaseForm';

beforeEach(() => {
  createLeaseMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Tenant ID'), 'tenant-1');
  await user.type(screen.getByLabelText('Unit ID'), 'unit-1');
  await user.type(screen.getByLabelText('Lease #'), 'LSE-0001');
  await user.type(screen.getByLabelText('Start date'), '2026-01-01');
  await user.type(screen.getByLabelText('End date'), '2026-12-31');
  await user.type(screen.getByLabelText('Rent amount'), '150000');
}

describe('CreateLeaseForm', () => {
  it('renders every field with its label', () => {
    render(<CreateLeaseForm entityId="ent-1" />);

    expect(screen.getByLabelText('Tenant ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Lease #')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
    expect(screen.getByLabelText('Rent amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Rent frequency')).toBeInTheDocument();
    expect(screen.getByLabelText('Deposit (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add lease' })).toBeInTheDocument();
  });

  it('marks every field required except rent frequency and deposit', () => {
    render(<CreateLeaseForm entityId="ent-1" />);

    expect(screen.getByLabelText('Tenant ID')).toBeRequired();
    expect(screen.getByLabelText('Unit ID')).toBeRequired();
    expect(screen.getByLabelText('Lease #')).toBeRequired();
    expect(screen.getByLabelText('Start date')).toBeRequired();
    expect(screen.getByLabelText('End date')).toBeRequired();
    expect(screen.getByLabelText('Rent amount')).toBeRequired();
    expect(screen.getByLabelText('Rent frequency')).not.toBeRequired();
    expect(screen.getByLabelText('Deposit (optional)')).not.toBeRequired();
  });

  it('omits rentFrequency and depositAmount when left blank', async () => {
    createLeaseMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLeaseForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add lease' }));

    expect(createLeaseMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      tenantId: 'tenant-1',
      unitId: 'unit-1',
      leaseNumber: 'LSE-0001',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: 150000,
      rentFrequency: undefined,
      depositAmount: undefined,
    });
  });

  it('includes rentFrequency and converts depositAmount to a number when provided', async () => {
    createLeaseMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLeaseForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText('Rent frequency'), 'QUARTERLY');
    await user.type(screen.getByLabelText('Deposit (optional)'), '300000');
    await user.click(screen.getByRole('button', { name: 'Add lease' }));

    expect(createLeaseMock).toHaveBeenCalledWith(
      expect.objectContaining({ rentFrequency: 'QUARTERLY', depositAmount: 300000 }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createLeaseMock.mockResolvedValue({ ok: false, error: 'unit is already leased' });
    const user = userEvent.setup();
    render(<CreateLeaseForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add lease' }));

    expect(await screen.findByText('unit is already leased')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createLeaseMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLeaseForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText('Rent frequency'), 'QUARTERLY');
    await user.click(screen.getByRole('button', { name: 'Add lease' }));

    expect(await screen.findByLabelText('Tenant ID')).toHaveValue('');
    expect(screen.getByLabelText('Unit ID')).toHaveValue('');
    expect(screen.getByLabelText('Lease #')).toHaveValue('');
    expect(screen.getByLabelText('Rent amount')).toHaveValue(null);
    expect(screen.getByLabelText('Rent frequency')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createLeaseMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateLeaseForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add lease' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add lease' })).not.toBeDisabled();
  });
});
