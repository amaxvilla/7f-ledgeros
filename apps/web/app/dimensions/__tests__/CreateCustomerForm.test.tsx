import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createCustomerMock = vi.fn();
vi.mock('../actions', () => ({
  createCustomer: (...args: unknown[]) => createCustomerMock(...args),
}));

import { CreateCustomerForm } from '../CreateCustomerForm';

beforeEach(() => {
  createCustomerMock.mockReset();
});

describe('CreateCustomerForm', () => {
  it('renders every field', () => {
    render(<CreateCustomerForm />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add customer' })).toBeInTheDocument();
  });

  it('submits the entered values to createCustomer', async () => {
    createCustomerMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateCustomerForm />);

    await user.type(screen.getByLabelText('Code'), 'CUST-001');
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(createCustomerMock).toHaveBeenCalledWith({
      code: 'CUST-001',
      name: 'Jane Doe',
      email: undefined,
      phone: undefined,
    });
  });

  it('shows an error message when the action fails', async () => {
    createCustomerMock.mockResolvedValue({ ok: false, error: 'Customer code already exists.' });
    const user = userEvent.setup();
    render(<CreateCustomerForm />);

    await user.type(screen.getByLabelText('Code'), 'CUST-001');
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(await screen.findByText('Customer code already exists.')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createCustomerMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateCustomerForm />);

    await user.type(screen.getByLabelText('Code'), 'CUST-001');
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(await screen.findByText('Failed to create customer.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createCustomerMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateCustomerForm />);

    await user.type(screen.getByLabelText('Code'), 'CUST-001');
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email (optional)'), 'jane@example.com');
    await user.type(screen.getByLabelText('Phone (optional)'), '555-0100');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Email (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Phone (optional)')).toHaveValue('');
  });

  it('blocks submission and shows per-field errors when required fields are left blank', async () => {
    const user = userEvent.setup();
    render(<CreateCustomerForm />);

    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(await screen.findByText('Code is required')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an error when the optional email is malformed', async () => {
    const user = userEvent.setup();
    render(<CreateCustomerForm />);

    await user.type(screen.getByLabelText('Code'), 'CUST-001');
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email (optional)'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is edited', async () => {
    const user = userEvent.setup();
    render(<CreateCustomerForm />);

    await user.click(screen.getByRole('button', { name: 'Add customer' }));
    expect(await screen.findByText('Code is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Code'), 'C');
    expect(screen.queryByText('Code is required')).not.toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createCustomerMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateCustomerForm />);

    await user.type(screen.getByLabelText('Code'), 'CUST-001');
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add customer' })).not.toBeDisabled();
  });
});
