import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const closeRiskMock = vi.fn();
vi.mock('../actions', () => ({
  closeRisk: (...args: unknown[]) => closeRiskMock(...args),
}));

import { CloseRiskButton } from '../CloseRiskButton';

beforeEach(() => {
  closeRiskMock.mockReset();
});

describe('CloseRiskButton', () => {
  it('shows a Close button for an IDENTIFIED risk', () => {
    render(<CloseRiskButton id="risk-1" status="IDENTIFIED" />);

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows a Close button for a MONITORING risk', () => {
    render(<CloseRiskButton id="risk-1" status="MONITORING" />);

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows no button, just a dash, for an already-CLOSED risk', () => {
    render(<CloseRiskButton id="risk-1" status="CLOSED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls closeRisk with the risk id when clicked', async () => {
    closeRiskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CloseRiskButton id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(closeRiskMock).toHaveBeenCalledWith('risk-42');
  });

  it('shows the action-returned error message on failure', async () => {
    closeRiskMock.mockResolvedValue({ ok: false, error: 'This risk is already CLOSED' });
    const user = userEvent.setup();
    render(<CloseRiskButton id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('This risk is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    closeRiskMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CloseRiskButton id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Failed to close risk.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    closeRiskMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CloseRiskButton id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Closing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Close' })).not.toBeDisabled();
  });
});
