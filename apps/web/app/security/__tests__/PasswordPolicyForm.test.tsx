import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const savePasswordPolicyMock = vi.fn();
vi.mock('../actions', () => ({
  savePasswordPolicy: (...args: unknown[]) => savePasswordPolicyMock(...args),
}));

import { PasswordPolicyForm } from '../PasswordPolicyForm';

const CURRENT = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: false,
  expiryDays: 90,
  historyCount: 5,
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 30,
};

beforeEach(() => {
  savePasswordPolicyMock.mockReset();
});

describe('PasswordPolicyForm', () => {
  it('pre-fills every field from the current policy', () => {
    render(<PasswordPolicyForm current={CURRENT} />);

    expect(screen.getByLabelText('Minimum length')).toHaveValue(10);
    expect(screen.getByLabelText('Password history (reuse check)')).toHaveValue(5);
    expect(screen.getByLabelText('Expiry (days, optional)')).toHaveValue(90);
    expect(screen.getByLabelText('Max failed login attempts')).toHaveValue(5);
    expect(screen.getByLabelText('Lockout duration (minutes)')).toHaveValue(30);
    expect(screen.getByLabelText('Require an uppercase letter')).toBeChecked();
    expect(screen.getByLabelText('Require a lowercase letter')).toBeChecked();
    expect(screen.getByLabelText('Require a number')).toBeChecked();
    expect(screen.getByLabelText('Require a symbol')).not.toBeChecked();
  });

  it('renders an empty Expiry field when the current policy has none (never expires)', () => {
    render(<PasswordPolicyForm current={{ ...CURRENT, expiryDays: null }} />);

    expect(screen.getByLabelText('Expiry (days, optional)')).toHaveValue(null);
  });

  it('submits the current values unchanged when saved without edits', async () => {
    savePasswordPolicyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PasswordPolicyForm current={CURRENT} />);

    await user.click(screen.getByRole('button', { name: 'Save password policy' }));

    expect(savePasswordPolicyMock).toHaveBeenCalledWith(CURRENT);
  });

  it('toggling a checkbox changes the submitted payload', async () => {
    savePasswordPolicyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PasswordPolicyForm current={CURRENT} />);

    await user.click(screen.getByLabelText('Require a symbol'));
    await user.click(screen.getByRole('button', { name: 'Save password policy' }));

    expect(savePasswordPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ requireSymbol: true }));
  });

  it('clearing Expiry sends undefined rather than 0 or null', async () => {
    savePasswordPolicyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PasswordPolicyForm current={CURRENT} />);

    await user.clear(screen.getByLabelText('Expiry (days, optional)'));
    await user.click(screen.getByRole('button', { name: 'Save password policy' }));

    expect(savePasswordPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ expiryDays: undefined }));
  });

  it('shows a "Saved." confirmation after a successful save', async () => {
    savePasswordPolicyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PasswordPolicyForm current={CURRENT} />);

    await user.click(screen.getByRole('button', { name: 'Save password policy' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('does NOT reset the form fields after a successful save (a settings form, not a create form)', async () => {
    savePasswordPolicyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PasswordPolicyForm current={CURRENT} />);

    await user.click(screen.getByRole('button', { name: 'Save password policy' }));

    await screen.findByText('Saved.');
    expect(screen.getByLabelText('Minimum length')).toHaveValue(10);
    expect(screen.getByLabelText('Require an uppercase letter')).toBeChecked();
  });

  it('shows the action-returned error message on failure', async () => {
    savePasswordPolicyMock.mockResolvedValue({ ok: false, error: 'minLength must not be less than 6' });
    const user = userEvent.setup();
    render(<PasswordPolicyForm current={CURRENT} />);

    await user.click(screen.getByRole('button', { name: 'Save password policy' }));

    expect(await screen.findByText('minLength must not be less than 6')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    savePasswordPolicyMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<PasswordPolicyForm current={CURRENT} />);

    await user.click(screen.getByRole('button', { name: 'Save password policy' }));

    expect(await screen.findByText('Failed to save password policy.')).toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    savePasswordPolicyMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<PasswordPolicyForm current={CURRENT} />);

    await user.click(screen.getByRole('button', { name: 'Save password policy' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Save password policy' })).not.toBeDisabled();
  });
});
