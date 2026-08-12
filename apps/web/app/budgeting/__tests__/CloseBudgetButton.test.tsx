import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const closeBudgetMock = vi.fn();
vi.mock('../actions', () => ({
  closeBudget: (...args: unknown[]) => closeBudgetMock(...args),
}));

import { CloseBudgetButton } from '../CloseBudgetButton';

beforeEach(() => {
  closeBudgetMock.mockReset();
});

describe('CloseBudgetButton', () => {
  it('shows a Close button for an APPROVED budget', () => {
    render(<CloseBudgetButton id="budget-1" status="APPROVED" />);

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it.each(['DRAFT', 'SUBMITTED', 'REJECTED', 'FROZEN', 'CLOSED'])(
    'shows no button, just a dash, for a %s budget',
    (status) => {
      render(<CloseBudgetButton id="budget-1" status={status} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    },
  );

  it('calls closeBudget with the budget id when clicked', async () => {
    closeBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CloseBudgetButton id="budget-42" status="APPROVED" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(closeBudgetMock).toHaveBeenCalledWith('budget-42');
  });

  it('shows the action-returned error message on failure', async () => {
    closeBudgetMock.mockResolvedValue({ ok: false, error: 'This budget is no longer APPROVED' });
    const user = userEvent.setup();
    render(<CloseBudgetButton id="budget-42" status="APPROVED" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('This budget is no longer APPROVED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    closeBudgetMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CloseBudgetButton id="budget-42" status="APPROVED" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Failed to close budget.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    closeBudgetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CloseBudgetButton id="budget-42" status="APPROVED" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Closing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Close' })).not.toBeDisabled();
  });
});
