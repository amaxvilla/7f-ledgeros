import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const completeCorrectiveActionMock = vi.fn();
vi.mock('../actions', () => ({
  completeCorrectiveAction: (...args: unknown[]) => completeCorrectiveActionMock(...args),
}));

import { CorrectiveActionActions } from '../CorrectiveActionActions';

beforeEach(() => {
  completeCorrectiveActionMock.mockReset();
});

describe('CorrectiveActionActions', () => {
  it('shows "Complete" for an OPEN corrective action', () => {
    render(<CorrectiveActionActions id="ca-1" status="OPEN" />);

    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
  });

  it('shows "Complete" for an IN_PROGRESS corrective action', () => {
    render(<CorrectiveActionActions id="ca-1" status="IN_PROGRESS" />);

    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
  });

  it('shows "Complete" for an OVERDUE corrective action', () => {
    render(<CorrectiveActionActions id="ca-1" status="OVERDUE" />);

    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
  });

  it('shows no button, just a dash, for an already-COMPLETED corrective action', () => {
    render(<CorrectiveActionActions id="ca-1" status="COMPLETED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls completeCorrectiveAction with the id when "Complete" is clicked', async () => {
    completeCorrectiveActionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CorrectiveActionActions id="ca-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Complete' }));

    expect(completeCorrectiveActionMock).toHaveBeenCalledWith('ca-42');
  });

  it('shows the action-returned error message on failure', async () => {
    completeCorrectiveActionMock.mockResolvedValue({ ok: false, error: 'Corrective action ca-42 not found' });
    const user = userEvent.setup();
    render(<CorrectiveActionActions id="ca-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Complete' }));

    expect(await screen.findByText('Corrective action ca-42 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    completeCorrectiveActionMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CorrectiveActionActions id="ca-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Complete' }));

    expect(await screen.findByText('Failed to complete corrective action.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    completeCorrectiveActionMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CorrectiveActionActions id="ca-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Complete' }));
    expect(screen.getByRole('button', { name: 'Completing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Complete' })).not.toBeDisabled();
  });
});
