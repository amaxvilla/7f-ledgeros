import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const unlockAccountMock = vi.fn();
const revokeAllSessionsMock = vi.fn();
vi.mock('../actions', () => ({
  unlockAccount: (...args: unknown[]) => unlockAccountMock(...args),
  revokeAllSessions: (...args: unknown[]) => revokeAllSessionsMock(...args),
}));

import { SecurityAdminActions } from '../SecurityAdminActions';

beforeEach(() => {
  unlockAccountMock.mockReset();
  revokeAllSessionsMock.mockReset();
});

describe('SecurityAdminActions — unlock gating', () => {
  it('shows Unlock account when locked is true', () => {
    render(<SecurityAdminActions userId="user-1" locked={true} />);

    expect(screen.getByRole('button', { name: 'Unlock account' })).toBeInTheDocument();
  });

  it('hides Unlock account entirely when locked is false', () => {
    render(<SecurityAdminActions userId="user-1" locked={false} />);

    expect(screen.queryByRole('button', { name: 'Unlock account' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Unlock reason (optional)')).not.toBeInTheDocument();
  });

  it('always shows Revoke all sessions regardless of locked state', () => {
    const { rerender } = render(<SecurityAdminActions userId="user-1" locked={false} />);
    expect(screen.getByRole('button', { name: 'Revoke all sessions' })).toBeInTheDocument();

    rerender(<SecurityAdminActions userId="user-1" locked={true} />);
    expect(screen.getByRole('button', { name: 'Revoke all sessions' })).toBeInTheDocument();
  });
});

describe('SecurityAdminActions — unlock', () => {
  it('calls unlockAccount with the user id and typed reason on submit', async () => {
    unlockAccountMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={true} />);

    await user.type(screen.getByLabelText('Unlock reason (optional)'), 'Customer called support');
    await user.click(screen.getByRole('button', { name: 'Unlock account' }));

    expect(unlockAccountMock).toHaveBeenCalledWith('user-42', 'Customer called support');
  });

  it('calls unlockAccount with undefined when no reason is typed', async () => {
    unlockAccountMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={true} />);

    await user.click(screen.getByRole('button', { name: 'Unlock account' }));

    expect(unlockAccountMock).toHaveBeenCalledWith('user-42', undefined);
  });

  it('shows the action-returned error message when unlock fails', async () => {
    unlockAccountMock.mockResolvedValue({ ok: false, error: 'User user-42 not found' });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={true} />);

    await user.click(screen.getByRole('button', { name: 'Unlock account' }));

    expect(await screen.findByText('User user-42 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when unlock fails without one', async () => {
    unlockAccountMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={true} />);

    await user.click(screen.getByRole('button', { name: 'Unlock account' }));

    expect(await screen.findByText('Failed to unlock account.')).toBeInTheDocument();
  });

  it('clears the reason field after a successful unlock', async () => {
    unlockAccountMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={true} />);

    await user.type(screen.getByLabelText('Unlock reason (optional)'), 'Customer called support');
    await user.click(screen.getByRole('button', { name: 'Unlock account' }));

    expect(await screen.findByLabelText('Unlock reason (optional)')).toHaveValue('');
  });

  it('disables the Unlock button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    unlockAccountMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={true} />);

    await user.click(screen.getByRole('button', { name: 'Unlock account' }));
    expect(screen.getByRole('button', { name: 'Unlocking…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Unlock account' })).not.toBeDisabled();
  });
});

describe('SecurityAdminActions — revoke all sessions', () => {
  it('calls revokeAllSessions with the user id when clicked', async () => {
    revokeAllSessionsMock.mockResolvedValue({ ok: true, revokedCount: 3 });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={false} />);

    await user.click(screen.getByRole('button', { name: 'Revoke all sessions' }));

    expect(revokeAllSessionsMock).toHaveBeenCalledWith('user-42');
  });

  it('shows the real revoked count on success', async () => {
    revokeAllSessionsMock.mockResolvedValue({ ok: true, revokedCount: 3 });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={false} />);

    await user.click(screen.getByRole('button', { name: 'Revoke all sessions' }));

    expect(await screen.findByText('3 sessions revoked.')).toBeInTheDocument();
  });

  it('uses singular phrasing when exactly one session is revoked', async () => {
    revokeAllSessionsMock.mockResolvedValue({ ok: true, revokedCount: 1 });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={false} />);

    await user.click(screen.getByRole('button', { name: 'Revoke all sessions' }));

    expect(await screen.findByText('1 session revoked.')).toBeInTheDocument();
  });

  it('shows the action-returned error message when revoke fails', async () => {
    revokeAllSessionsMock.mockResolvedValue({ ok: false, error: 'Something went wrong' });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={false} />);

    await user.click(screen.getByRole('button', { name: 'Revoke all sessions' }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('falls back to a generic error message when revoke fails without one', async () => {
    revokeAllSessionsMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={false} />);

    await user.click(screen.getByRole('button', { name: 'Revoke all sessions' }));

    expect(await screen.findByText('Failed to revoke sessions.')).toBeInTheDocument();
  });

  it('disables the Revoke all sessions button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean; revokedCount?: number }) => void = () => {};
    revokeAllSessionsMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<SecurityAdminActions userId="user-42" locked={false} />);

    await user.click(screen.getByRole('button', { name: 'Revoke all sessions' }));
    expect(screen.getByRole('button', { name: 'Revoking…' })).toBeDisabled();

    resolveAction({ ok: true, revokedCount: 2 });
    expect(await screen.findByRole('button', { name: 'Revoke all sessions' })).not.toBeDisabled();
  });
});
