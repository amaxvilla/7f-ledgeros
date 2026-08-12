import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const approveBudgetMock = vi.fn();
const rejectBudgetMock = vi.fn();
vi.mock('../actions', () => ({
  approveBudget: (...args: unknown[]) => approveBudgetMock(...args),
  rejectBudget: (...args: unknown[]) => rejectBudgetMock(...args),
}));

import { BudgetDecisionActions } from '../BudgetDecisionActions';

beforeEach(() => {
  approveBudgetMock.mockReset();
  rejectBudgetMock.mockReset();
});

describe('BudgetDecisionActions', () => {
  it('shows Approve and Reject buttons plus a comments field for a SUBMITTED budget', () => {
    render(<BudgetDecisionActions id="budget-1" status="SUBMITTED" />);

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByLabelText('Comments (optional)')).toBeInTheDocument();
  });

  it.each(['DRAFT', 'APPROVED', 'REJECTED', 'FROZEN', 'CLOSED'])(
    'shows no buttons, just a dash, for a %s budget',
    (status) => {
      render(<BudgetDecisionActions id="budget-1" status={status} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    },
  );

  it('calls approveBudget with the budget id and no comments when the field is left blank', async () => {
    approveBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(approveBudgetMock).toHaveBeenCalledWith('budget-42', undefined);
  });

  it('calls rejectBudget with the budget id and no comments when the field is left blank', async () => {
    rejectBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(rejectBudgetMock).toHaveBeenCalledWith('budget-42', undefined);
  });

  it('passes the trimmed comments text to whichever action is clicked', async () => {
    approveBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.type(screen.getByLabelText('Comments (optional)'), '  Looks good  ');
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(approveBudgetMock).toHaveBeenCalledWith('budget-42', 'Looks good');
  });

  it('shares the same comments text between Approve and Reject (one shared field, not two)', async () => {
    rejectBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.type(screen.getByLabelText('Comments (optional)'), 'Over budget');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(rejectBudgetMock).toHaveBeenCalledWith('budget-42', 'Over budget');
  });

  it('shows the action-returned error message on approve failure', async () => {
    approveBudgetMock.mockResolvedValue({ ok: false, error: 'This budget is no longer SUBMITTED' });
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('This budget is no longer SUBMITTED')).toBeInTheDocument();
  });

  it('shows the action-returned error message on reject failure', async () => {
    rejectBudgetMock.mockResolvedValue({ ok: false, error: 'This budget is no longer SUBMITTED' });
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('This budget is no longer SUBMITTED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when approve fails without one', async () => {
    approveBudgetMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Failed to approve budget.')).toBeInTheDocument();
  });

  it('falls back to a generic error message when reject fails without one', async () => {
    rejectBudgetMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Failed to reject budget.')).toBeInTheDocument();
  });

  it('disables both buttons and the comments field, and shows the pending label, while approve is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    approveBudgetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('button', { name: 'Approving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    expect(screen.getByLabelText('Comments (optional)')).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Approve' })).not.toBeDisabled();
  });

  it('disables both buttons and shows the pending label while reject is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    rejectBudgetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<BudgetDecisionActions id="budget-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('button', { name: 'Rejecting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reject' })).not.toBeDisabled();
  });
});
