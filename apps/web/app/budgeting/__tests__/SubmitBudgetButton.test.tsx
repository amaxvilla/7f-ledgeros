import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const submitBudgetMock = vi.fn();
vi.mock('../actions', () => ({
  submitBudget: (...args: unknown[]) => submitBudgetMock(...args),
}));

import { SubmitBudgetButton } from '../SubmitBudgetButton';

beforeEach(() => {
  submitBudgetMock.mockReset();
});

describe('SubmitBudgetButton', () => {
  it('shows a Submit button for a DRAFT budget', () => {
    render(<SubmitBudgetButton id="budget-1" status="DRAFT" />);

    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('shows a Submit button for a REJECTED budget', () => {
    render(<SubmitBudgetButton id="budget-1" status="REJECTED" />);

    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a SUBMITTED budget', () => {
    render(<SubmitBudgetButton id="budget-1" status="SUBMITTED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for an APPROVED budget', () => {
    render(<SubmitBudgetButton id="budget-1" status="APPROVED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a FROZEN budget', () => {
    render(<SubmitBudgetButton id="budget-1" status="FROZEN" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a CLOSED budget', () => {
    render(<SubmitBudgetButton id="budget-1" status="CLOSED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls submitBudget with the budget id when clicked', async () => {
    submitBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SubmitBudgetButton id="budget-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(submitBudgetMock).toHaveBeenCalledWith('budget-42');
  });

  it('shows the action-returned error message on failure', async () => {
    submitBudgetMock.mockResolvedValue({ ok: false, error: 'This budget is already SUBMITTED' });
    const user = userEvent.setup();
    render(<SubmitBudgetButton id="budget-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('This budget is already SUBMITTED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    submitBudgetMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<SubmitBudgetButton id="budget-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Failed to submit budget.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    submitBudgetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<SubmitBudgetButton id="budget-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Submit' })).not.toBeDisabled();
  });
});
