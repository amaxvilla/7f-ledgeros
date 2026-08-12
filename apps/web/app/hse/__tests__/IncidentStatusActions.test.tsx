import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const advanceIncidentStatusMock = vi.fn();
vi.mock('../actions', () => ({
  advanceIncidentStatus: (...args: unknown[]) => advanceIncidentStatusMock(...args),
}));

import { IncidentStatusActions } from '../IncidentStatusActions';

beforeEach(() => {
  advanceIncidentStatusMock.mockReset();
});

describe('IncidentStatusActions', () => {
  it('shows "Start investigating" for an OPEN incident', () => {
    render(<IncidentStatusActions id="inc-1" status="OPEN" />);

    expect(screen.getByRole('button', { name: 'Start investigating' })).toBeInTheDocument();
  });

  it('shows "Close" for an INVESTIGATING incident', () => {
    render(<IncidentStatusActions id="inc-1" status="INVESTIGATING" />);

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a CLOSED incident', () => {
    render(<IncidentStatusActions id="inc-1" status="CLOSED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls advanceIncidentStatus with (id, "INVESTIGATING") when "Start investigating" is clicked', async () => {
    advanceIncidentStatusMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<IncidentStatusActions id="inc-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start investigating' }));

    expect(advanceIncidentStatusMock).toHaveBeenCalledWith('inc-42', 'INVESTIGATING');
  });

  it('calls advanceIncidentStatus with (id, "CLOSED") when "Close" is clicked', async () => {
    advanceIncidentStatusMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<IncidentStatusActions id="inc-42" status="INVESTIGATING" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(advanceIncidentStatusMock).toHaveBeenCalledWith('inc-42', 'CLOSED');
  });

  it('shows the action-returned error message on failure (e.g. blocked by open corrective actions)', async () => {
    advanceIncidentStatusMock.mockResolvedValue({
      ok: false,
      error: 'Cannot close incident: 2 corrective action(s) are not yet COMPLETED',
    });
    const user = userEvent.setup();
    render(<IncidentStatusActions id="inc-42" status="INVESTIGATING" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Cannot close incident: 2 corrective action(s) are not yet COMPLETED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    advanceIncidentStatusMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<IncidentStatusActions id="inc-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start investigating' }));

    expect(await screen.findByText('Failed to update incident status.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceIncidentStatusMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<IncidentStatusActions id="inc-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start investigating' }));
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Start investigating' })).not.toBeDisabled();
  });
});
