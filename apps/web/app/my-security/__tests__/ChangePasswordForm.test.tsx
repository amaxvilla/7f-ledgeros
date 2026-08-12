import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const changePasswordMock = vi.fn();
vi.mock('../actions', () => ({
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
}));

import { ChangePasswordForm } from '../ChangePasswordForm';

beforeEach(() => {
  changePasswordMock.mockReset();
});

async function fillFields(user: ReturnType<typeof userEvent.setup>, current = 'old-pass', next = 'new-pass') {
  await user.type(screen.getByLabelText('Current password'), current);
  await user.type(screen.getByLabelText('New password'), next);
}

describe('ChangePasswordForm', () => {
  it('renders both password fields as required, and the submit button', () => {
    render(<ChangePasswordForm />);

    expect(screen.getByLabelText('Current password')).toBeRequired();
    expect(screen.getByLabelText('New password')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
  });

  it('submits the current and new password to the action', async () => {
    changePasswordMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillFields(user, 'old-pass', 'new-pass');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(changePasswordMock).toHaveBeenCalledWith('old-pass', 'new-pass');
  });

  it('shows a success message and clears both fields on success', async () => {
    changePasswordMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Password changed.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it('shows the action-returned error message and does not clear the fields on failure', async () => {
    changePasswordMock.mockResolvedValue({ ok: false, error: 'Current password is incorrect' });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('old-pass');
    expect(screen.getByLabelText('New password')).toHaveValue('new-pass');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    changePasswordMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Failed to change password.')).toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    changePasswordMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    const pendingButton = screen.getByRole('button', { name: 'Changing…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Change password' })).not.toBeDisabled();
  });

  it('clears a previous success message when a new submit fails', async () => {
    changePasswordMock.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Password changed.')).toBeInTheDocument();

    changePasswordMock.mockResolvedValueOnce({ ok: false, error: 'Password does not meet complexity requirements' });
    await fillFields(user, 'old-pass-2', 'new-pass-2');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Password does not meet complexity requirements')).toBeInTheDocument();
    expect(screen.queryByText('Password changed.')).not.toBeInTheDocument();
  });
});
