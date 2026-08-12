import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const revokeLinkedAccountMock = vi.fn();
vi.mock('../actions', () => ({
  revokeLinkedAccount: (...args: unknown[]) => revokeLinkedAccountMock(...args),
}));

import { RevokeLinkedAccountButton } from '../RevokeLinkedAccountButton';

beforeEach(() => {
  revokeLinkedAccountMock.mockReset();
});

describe('RevokeLinkedAccountButton', () => {
  it('shows a Revoke button for an ACTIVE account', () => {
    render(<RevokeLinkedAccountButton id="la-1" status="ACTIVE" />);

    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('shows a Revoke button for an account that REQUIRES_REAUTH', () => {
    render(<RevokeLinkedAccountButton id="la-1" status="REQUIRES_REAUTH" />);

    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('shows no button, just a dash, for an already-REVOKED account', () => {
    render(<RevokeLinkedAccountButton id="la-1" status="REVOKED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls revokeLinkedAccount with the account id when clicked', async () => {
    revokeLinkedAccountMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RevokeLinkedAccountButton id="la-42" status="ACTIVE" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(revokeLinkedAccountMock).toHaveBeenCalledWith('la-42');
  });

  it('shows the action-returned error message on failure', async () => {
    revokeLinkedAccountMock.mockResolvedValue({ ok: false, error: 'Linked Mono account not found' });
    const user = userEvent.setup();
    render(<RevokeLinkedAccountButton id="la-42" status="ACTIVE" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Linked Mono account not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    revokeLinkedAccountMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RevokeLinkedAccountButton id="la-42" status="ACTIVE" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Failed to revoke linked account.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    revokeLinkedAccountMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RevokeLinkedAccountButton id="la-42" status="ACTIVE" />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(screen.getByRole('button', { name: 'Revoking…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Revoke' })).not.toBeDisabled();
  });
});
