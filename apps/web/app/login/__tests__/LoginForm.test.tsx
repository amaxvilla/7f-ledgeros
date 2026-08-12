import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same reasoning as every other Create*Form test in this app: login()
// and verifyMfa() are both 'use server' actions that call
// next/headers's cookies() and next/navigation's redirect(), neither of
// which exist in this test environment, so the whole ./actions module
// is mocked. Mocked before the component import so the module under
// test picks up the mock.
const loginMock = vi.fn();
const verifyMfaMock = vi.fn();
vi.mock('../actions', () => ({
  login: (...args: unknown[]) => loginMock(...args),
  verifyMfa: (...args: unknown[]) => verifyMfaMock(...args),
}));

import { LoginForm } from '../LoginForm';

beforeEach(() => {
  loginMock.mockReset();
  verifyMfaMock.mockReset();
});

async function fillFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'admin@7fifteen.example');
  await user.type(screen.getByLabelText('Password'), 'correct horse battery staple');
}

describe('LoginForm', () => {
  it('renders the email and password fields, both required, and a submit button', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('submits the entered email and password to login()', async () => {
    loginMock.mockResolvedValue({ ok: false, error: 'Invalid credentials' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(loginMock).toHaveBeenCalledWith({
      email: 'admin@7fifteen.example',
      password: 'correct horse battery staple',
    });
  });

  it('switches to the code step when login() reports mfaRequired, without calling verifyMfa yet', async () => {
    loginMock.mockResolvedValue({ ok: false, mfaRequired: true, challengeToken: 'chal-1' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByLabelText('Verification code')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(verifyMfaMock).not.toHaveBeenCalled();
  });

  it('submits the challengeToken and entered code to verifyMfa()', async () => {
    loginMock.mockResolvedValue({ ok: false, mfaRequired: true, challengeToken: 'chal-1' });
    verifyMfaMock.mockResolvedValue({ ok: false, error: 'Invalid code' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(verifyMfaMock).toHaveBeenCalledWith({ challengeToken: 'chal-1', token: '123456', rememberDevice: false });
  });

  it('passes rememberDevice: true to verifyMfa() when the checkbox is checked', async () => {
    loginMock.mockResolvedValue({ ok: false, mfaRequired: true, challengeToken: 'chal-1' });
    verifyMfaMock.mockResolvedValue({ ok: false, error: 'Invalid code' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByLabelText('Remember this device for 30 days'));
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(verifyMfaMock).toHaveBeenCalledWith({ challengeToken: 'chal-1', token: '123456', rememberDevice: true });
  });

  it('resets the checkbox when going back to the password step', async () => {
    loginMock.mockResolvedValue({ ok: false, mfaRequired: true, challengeToken: 'chal-1' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.click(await screen.findByLabelText('Remember this device for 30 days'));
    await user.click(screen.getByRole('button', { name: 'Back to log in' }));

    // "Back to log in" deliberately preserves email/password (see
    // LoginForm's own doc comment/handler — only challengeToken, code,
    // rememberDevice, and error are reset), so the fields are already
    // correctly populated here. Re-running fillFields would re-type into
    // already-filled controlled inputs and produce a doubled, invalid
    // two-`@` email that fails the native `type="email"` constraint
    // check on submit — a real, confirmed cause of this test's own
    // previous flakiness, not a bug in the component.
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByLabelText('Remember this device for 30 days')).not.toBeChecked();
  });

  it('shows the action-returned error message when verification fails', async () => {
    loginMock.mockResolvedValue({ ok: false, mfaRequired: true, challengeToken: 'chal-1' });
    verifyMfaMock.mockResolvedValue({ ok: false, error: 'Invalid or expired code' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.type(await screen.findByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Invalid or expired code')).toBeInTheDocument();
  });

  it('returns to the password step and clears the code on "Back to log in"', async () => {
    loginMock.mockResolvedValue({ ok: false, mfaRequired: true, challengeToken: 'chal-1' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Back to log in' }));

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    loginMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Login failed.')).toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    loginMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const pendingButton = screen.getByRole('button', { name: 'Logging in\u2026' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: false });
    expect(await screen.findByRole('button', { name: 'Log in' })).not.toBeDisabled();
  });

  it('disables the verify button and shows the pending label while verifyMfa is in flight', async () => {
    loginMock.mockResolvedValue({ ok: false, mfaRequired: true, challengeToken: 'chal-1' });
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    verifyMfaMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillFields(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    const pendingButton = screen.getByRole('button', { name: 'Verifying\u2026' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: false });
    expect(await screen.findByRole('button', { name: 'Verify' })).not.toBeDisabled();
  });
});
