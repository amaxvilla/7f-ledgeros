import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const advanceNearMissStatusMock = vi.fn();
vi.mock('../actions', () => ({
  advanceNearMissStatus: (...args: unknown[]) => advanceNearMissStatusMock(...args),
}));

import { NearMissStatusActions } from '../NearMissStatusActions';

beforeEach(() => {
  advanceNearMissStatusMock.mockReset();
});

describe('NearMissStatusActions', () => {
  it('shows "Start investigating" for an OPEN near miss', () => {
    render(<NearMissStatusActions id="nm-1" status="OPEN" />);

    expect(screen.getByRole('button', { name: 'Start investigating' })).toBeInTheDocument();
  });

  it('shows "Close" for an INVESTIGATING near miss', () => {
    render(<NearMissStatusActions id="nm-1" status="INVESTIGATING" />);

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a CLOSED near miss', () => {
    render(<NearMissStatusActions id="nm-1" status="CLOSED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls advanceNearMissStatus with (id, "INVESTIGATING") when "Start investigating" is clicked', async () => {
    advanceNearMissStatusMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NearMissStatusActions id="nm-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start investigating' }));

    expect(advanceNearMissStatusMock).toHaveBeenCalledWith('nm-42', 'INVESTIGATING');
  });

  it('calls advanceNearMissStatus with (id, "CLOSED") when "Close" is clicked', async () => {
    advanceNearMissStatusMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NearMissStatusActions id="nm-42" status="INVESTIGATING" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(advanceNearMissStatusMock).toHaveBeenCalledWith('nm-42', 'CLOSED');
  });

  it('shows the action-returned error message on failure', async () => {
    advanceNearMissStatusMock.mockResolvedValue({ ok: false, error: 'Near miss nm-42 not found' });
    const user = userEvent.setup();
    render(<NearMissStatusActions id="nm-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start investigating' }));

    expect(await screen.findByText('Near miss nm-42 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    advanceNearMissStatusMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<NearMissStatusActions id="nm-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start investigating' }));

    expect(await screen.findByText('Failed to update near miss status.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceNearMissStatusMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<NearMissStatusActions id="nm-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start investigating' }));
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Start investigating' })).not.toBeDisabled();
  });
});
