import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createVendorMock = vi.fn();
vi.mock('../actions', () => ({
  createVendor: (...args: unknown[]) => createVendorMock(...args),
}));

import { CreateVendorForm } from '../CreateVendorForm';

beforeEach(() => {
  createVendorMock.mockReset();
});

describe('CreateVendorForm', () => {
  it('renders every field', () => {
    render(<CreateVendorForm />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Tax ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Bank name (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Bank account number (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add vendor' })).toBeInTheDocument();
  });

  it('submits the entered values to createVendor', async () => {
    createVendorMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateVendorForm />);

    await user.type(screen.getByLabelText('Code'), 'VEND-001');
    await user.type(screen.getByLabelText('Name'), 'Acme Building Supplies');
    await user.click(screen.getByRole('button', { name: 'Add vendor' }));

    expect(createVendorMock).toHaveBeenCalledWith({
      code: 'VEND-001',
      name: 'Acme Building Supplies',
      taxId: undefined,
      bankName: undefined,
      bankAccountNumber: undefined,
    });
  });

  it('shows an error message when the action fails', async () => {
    createVendorMock.mockResolvedValue({ ok: false, error: 'Vendor code already exists.' });
    const user = userEvent.setup();
    render(<CreateVendorForm />);

    await user.type(screen.getByLabelText('Code'), 'VEND-001');
    await user.type(screen.getByLabelText('Name'), 'Acme Building Supplies');
    await user.click(screen.getByRole('button', { name: 'Add vendor' }));

    expect(await screen.findByText('Vendor code already exists.')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createVendorMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateVendorForm />);

    await user.type(screen.getByLabelText('Code'), 'VEND-001');
    await user.type(screen.getByLabelText('Name'), 'Acme Building Supplies');
    await user.click(screen.getByRole('button', { name: 'Add vendor' }));

    expect(await screen.findByText('Failed to create vendor.')).toBeInTheDocument();
  });

  it('blocks submission and shows per-field errors when required fields are left blank', async () => {
    const user = userEvent.setup();
    render(<CreateVendorForm />);

    await user.click(screen.getByRole('button', { name: 'Add vendor' }));

    expect(await screen.findByText('Code is required')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(createVendorMock).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is edited', async () => {
    const user = userEvent.setup();
    render(<CreateVendorForm />);

    await user.click(screen.getByRole('button', { name: 'Add vendor' }));
    expect(await screen.findByText('Code is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Code'), 'V');
    expect(screen.queryByText('Code is required')).not.toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createVendorMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateVendorForm />);

    await user.type(screen.getByLabelText('Code'), 'VEND-001');
    await user.type(screen.getByLabelText('Name'), 'Acme Building Supplies');
    await user.type(screen.getByLabelText('Tax ID (optional)'), 'TIN-9988');
    await user.type(screen.getByLabelText('Bank name (optional)'), 'First Merchant Bank');
    await user.type(screen.getByLabelText('Bank account number (optional)'), '0011223344');
    await user.click(screen.getByRole('button', { name: 'Add vendor' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Tax ID (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Bank name (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Bank account number (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createVendorMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateVendorForm />);

    await user.type(screen.getByLabelText('Code'), 'VEND-001');
    await user.type(screen.getByLabelText('Name'), 'Acme Building Supplies');
    await user.click(screen.getByRole('button', { name: 'Add vendor' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add vendor' })).not.toBeDisabled();
  });
});
