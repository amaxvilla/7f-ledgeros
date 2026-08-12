import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createAccountMock = vi.fn();
vi.mock('../actions', () => ({
  createAccount: (...args: unknown[]) => createAccountMock(...args),
}));

import { CreateAccountForm } from '../CreateAccountForm';

beforeEach(() => {
  createAccountMock.mockReset();
});

describe('CreateAccountForm', () => {
  it('renders every field', () => {
    render(<CreateAccountForm />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Account type')).toBeInTheDocument();
    expect(screen.getByLabelText('Account category')).toBeInTheDocument();
    expect(screen.getByLabelText('IFRS mapping (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Parent account ID (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument();
  });

  it('submits the entered values to createAccount', async () => {
    createAccountMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateAccountForm />);

    await user.type(screen.getByLabelText('Code'), '1000-100');
    await user.type(screen.getByLabelText('Name'), 'Cash at bank');
    await user.selectOptions(screen.getByLabelText('Account type'), 'ASSET');
    await user.selectOptions(screen.getByLabelText('Account category'), 'CURRENT_ASSET');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    expect(createAccountMock).toHaveBeenCalledWith({
      code: '1000-100',
      name: 'Cash at bank',
      accountType: 'ASSET',
      accountCategory: 'CURRENT_ASSET',
      ifrsMapping: undefined,
      parentAccountId: undefined,
    });
  });

  it('shows an error message when the action fails', async () => {
    createAccountMock.mockResolvedValue({ ok: false, error: 'Account code already exists.' });
    const user = userEvent.setup();
    render(<CreateAccountForm />);

    await user.type(screen.getByLabelText('Code'), '1000-100');
    await user.type(screen.getByLabelText('Name'), 'Cash at bank');
    await user.selectOptions(screen.getByLabelText('Account type'), 'ASSET');
    await user.selectOptions(screen.getByLabelText('Account category'), 'CURRENT_ASSET');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    expect(await screen.findByText('Account code already exists.')).toBeInTheDocument();
  });
});
