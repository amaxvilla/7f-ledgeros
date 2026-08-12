import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same reasoning as every other Create*Form/LoginForm test in this app:
// beginMfaEnrollment()/confirmMfaEnrollment() are both 'use server'
// actions calling fetchApi (which itself calls next/headers's
// cookies()), which doesn't exist in this test environment, so the
// whole ./actions module is mocked. Mocked before the component import
// so the module under test picks up the mock.
const beginMfaEnrollmentMock = vi.fn();
const confirmMfaEnrollmentMock = vi.fn();
vi.mock('../actions', () => ({
  beginMfaEnrollment: (...args: unknown[]) => beginMfaEnrollmentMock(...args),
  confirmMfaEnrollment: (...args: unknown[]) => confirmMfaEnrollmentMock(...args),
}));

import { EnrollMfaForm } from '../EnrollMfaForm';

beforeEach(() => {
  beginMfaEnrollmentMock.mockReset();
  confirmMfaEnrollmentMock.mockReset();
});

describe('EnrollMfaForm', () => {
  it('renders the start step with an "Enable two-factor authentication" button', () => {
    render(<EnrollMfaForm />);
    expect(screen.getByRole('button', { name: 'Enable two-factor authentication' })).toBeInTheDocument();
  });

  it('shows "already enabled" when beginMfaEnrollment reports it, without ever reaching the verify step', async () => {
    beginMfaEnrollmentMock.mockResolvedValue({ ok: false, alreadyEnabled: true });
    const user = userEvent.setup();
    render(<EnrollMfaForm />);

    await user.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }));

    expect(screen.getByText('Two-factor authentication is already enabled on your account.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Authentication code')).not.toBeInTheDocument();
  });

  it('shows a generic error and stays on the start step when beginMfaEnrollment fails for another reason', async () => {
    beginMfaEnrollmentMock.mockResolvedValue({ ok: false, error: 'Network error' });
    const user = userEvent.setup();
    render(<EnrollMfaForm />);

    await user.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }));

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable two-factor authentication' })).toBeInTheDocument();
  });

  it('renders the QR code, manual secret, and code field on successful enrollment start', async () => {
    beginMfaEnrollmentMock.mockResolvedValue({ ok: true, secret: 'JBSWY3DPEHPK3PXP', qrCodeDataUrl: 'data:image/png;base64,xyz' });
    const user = userEvent.setup();
    render(<EnrollMfaForm />);

    await user.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }));

    expect(screen.getByAltText('MFA enrollment QR code')).toHaveAttribute('src', 'data:image/png;base64,xyz');
    expect(screen.getByText(/JBSWY3DPEHPK3PXP/)).toBeInTheDocument();
    expect(screen.getByLabelText('Authentication code')).toBeRequired();
  });

  it('submits the entered code to confirmMfaEnrollment and shows recovery codes on success', async () => {
    beginMfaEnrollmentMock.mockResolvedValue({ ok: true, secret: 'JBSWY3DPEHPK3PXP', qrCodeDataUrl: 'data:image/png;base64,xyz' });
    confirmMfaEnrollmentMock.mockResolvedValue({ ok: true, recoveryCodes: ['aaaa1111', 'bbbb2222'] });
    const user = userEvent.setup();
    render(<EnrollMfaForm />);

    await user.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }));
    await user.type(screen.getByLabelText('Authentication code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(confirmMfaEnrollmentMock).toHaveBeenCalledWith('123456');
    expect(screen.getByText('aaaa1111')).toBeInTheDocument();
    expect(screen.getByText('bbbb2222')).toBeInTheDocument();
    expect(screen.queryByLabelText('Authentication code')).not.toBeInTheDocument();
  });

  it('shows an error and stays on the verify step when confirmMfaEnrollment fails', async () => {
    beginMfaEnrollmentMock.mockResolvedValue({ ok: true, secret: 'JBSWY3DPEHPK3PXP', qrCodeDataUrl: 'data:image/png;base64,xyz' });
    confirmMfaEnrollmentMock.mockResolvedValue({ ok: false, error: 'Invalid or expired code.' });
    const user = userEvent.setup();
    render(<EnrollMfaForm />);

    await user.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }));
    await user.type(screen.getByLabelText('Authentication code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(screen.getByText('Invalid or expired code.')).toBeInTheDocument();
    expect(screen.getByLabelText('Authentication code')).toBeInTheDocument();
  });

  it('resets back to the start step after "Done" on the recovery-codes step', async () => {
    beginMfaEnrollmentMock.mockResolvedValue({ ok: true, secret: 'JBSWY3DPEHPK3PXP', qrCodeDataUrl: 'data:image/png;base64,xyz' });
    confirmMfaEnrollmentMock.mockResolvedValue({ ok: true, recoveryCodes: ['aaaa1111'] });
    const user = userEvent.setup();
    render(<EnrollMfaForm />);

    await user.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }));
    await user.type(screen.getByLabelText('Authentication code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and enable' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('button', { name: 'Enable two-factor authentication' })).toBeInTheDocument();
    expect(screen.queryByText('aaaa1111')).not.toBeInTheDocument();
  });
});
