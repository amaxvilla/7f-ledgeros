import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const revokeDeviceMock = vi.fn();
vi.mock('../actions', () => ({
  revokeDevice: (...args: unknown[]) => revokeDeviceMock(...args),
}));

import { RevokeDeviceButton } from '../RevokeDeviceButton';

beforeEach(() => {
  revokeDeviceMock.mockReset();
});

describe('RevokeDeviceButton', () => {
  it('renders a Revoke button', () => {
    render(<RevokeDeviceButton userId="user-1" deviceId="device-1" />);

    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('calls revokeDevice with the user id and device id when clicked', async () => {
    revokeDeviceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RevokeDeviceButton userId="user-42" deviceId="device-7" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(revokeDeviceMock).toHaveBeenCalledWith('user-42', 'device-7');
  });

  it('shows the action-returned error message on failure', async () => {
    revokeDeviceMock.mockResolvedValue({ ok: false, error: 'Trusted device device-7 not found' });
    const user = userEvent.setup();
    render(<RevokeDeviceButton userId="user-42" deviceId="device-7" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Trusted device device-7 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    revokeDeviceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RevokeDeviceButton userId="user-42" deviceId="device-7" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Failed to revoke device.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    revokeDeviceMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RevokeDeviceButton userId="user-42" deviceId="device-7" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(screen.getByRole('button', { name: 'Revoking…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Revoke' })).not.toBeDisabled();
  });

  it('re-enables the button after a failed attempt so the admin can retry', async () => {
    revokeDeviceMock.mockResolvedValue({ ok: false, error: 'Network error' });
    const user = userEvent.setup();
    render(<RevokeDeviceButton userId="user-42" deviceId="device-7" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByRole('button', { name: 'Revoke' })).not.toBeDisabled();
  });
});
