import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const declineEnvelopeMock = vi.fn();
vi.mock('../actions', () => ({
  declineEnvelope: (...args: unknown[]) => declineEnvelopeMock(...args),
}));

import { DeclineEnvelopeButton } from '../DeclineEnvelopeButton';

beforeEach(() => {
  declineEnvelopeMock.mockReset();
});

describe('DeclineEnvelopeButton', () => {
  it('shows a Decline button for a SENT envelope', () => {
    render(<DeclineEnvelopeButton id="env-1" status="SENT" />);
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('shows a Decline button for a DELIVERED envelope', () => {
    render(<DeclineEnvelopeButton id="env-1" status="DELIVERED" />);
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it.each(['COMPLETED', 'DECLINED', 'VOIDED'])('shows no button, just a dash, for an already-%s envelope', (status) => {
    render(<DeclineEnvelopeButton id="env-1" status={status} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls declineEnvelope with the envelope id when clicked', async () => {
    declineEnvelopeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<DeclineEnvelopeButton id="env-42" status="SENT" />);

    await user.click(screen.getByRole('button', { name: 'Decline' }));

    expect(declineEnvelopeMock).toHaveBeenCalledWith('env-42');
  });

  it('shows the action-returned error message on failure', async () => {
    declineEnvelopeMock.mockResolvedValue({ ok: false, error: 'Manual signature envelope env-42 is already COMPLETED; nothing to decline' });
    const user = userEvent.setup();
    render(<DeclineEnvelopeButton id="env-42" status="SENT" />);

    await user.click(screen.getByRole('button', { name: 'Decline' }));

    expect(await screen.findByText('Manual signature envelope env-42 is already COMPLETED; nothing to decline')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    declineEnvelopeMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<DeclineEnvelopeButton id="env-42" status="SENT" />);

    await user.click(screen.getByRole('button', { name: 'Decline' }));

    expect(await screen.findByText('Failed to decline envelope.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    declineEnvelopeMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<DeclineEnvelopeButton id="env-42" status="SENT" />);

    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(screen.getByRole('button', { name: 'Declining…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Decline' })).not.toBeDisabled();
  });
});
