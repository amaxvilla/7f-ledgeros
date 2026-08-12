import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const reviseBudgetMock = vi.fn();
vi.mock('../../actions', () => ({
  reviseBudget: (...args: unknown[]) => reviseBudgetMock(...args),
}));

import { ReviseBudgetForm } from '../ReviseBudgetForm';

const LINE_OPTIONS = [
  { value: 'line-1', label: '5000 — Construction Costs · Month 1' },
  { value: 'line-2', label: '5100 — Professional Fees · Month 6' },
];

beforeEach(() => {
  reviseBudgetMock.mockReset();
});

async function fillChange(user: ReturnType<typeof userEvent.setup>, index: number, lineValue: string, newAmount: string) {
  await user.selectOptions(screen.getByLabelText(`Line (change ${index})`), lineValue);
  await user.type(screen.getByLabelText(`New amount (change ${index})`), newAmount);
}

describe('ReviseBudgetForm', () => {
  it('renders the reason field and a single change row by default', () => {
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    expect(screen.getByLabelText('Line (change 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('New amount (change 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Line (change 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit revision' })).toBeInTheDocument();
  });

  it('populates the line Select from the lineOptions prop', () => {
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    expect(screen.getByRole('option', { name: '5000 — Construction Costs · Month 1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '5100 — Professional Fees · Month 6' })).toBeInTheDocument();
  });

  it('marks Reason and every change row field as required', () => {
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    expect(screen.getByLabelText('Reason')).toBeRequired();
    expect(screen.getByLabelText('Line (change 1)')).toBeRequired();
    expect(screen.getByLabelText('New amount (change 1)')).toBeRequired();
  });

  it('adds a new, independently-fillable change row when "+ Add change" is clicked', async () => {
    const user = userEvent.setup();
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add change' }));

    expect(screen.getByLabelText('Line (change 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('New amount (change 2)')).toBeInTheDocument();
  });

  it('removes a change row when its own Remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add change' }));
    expect(screen.getByLabelText('Line (change 2)')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[1]);

    expect(screen.queryByLabelText('Line (change 2)')).not.toBeInTheDocument();
  });

  it("disables the only remaining row's Remove button — a revision always needs at least one changed line", () => {
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('submits a single-change payload with a numeric newAmount', async () => {
    reviseBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    await user.type(screen.getByLabelText('Reason'), 'Reforecast Q3 costs');
    await fillChange(user, 1, 'line-1', '175000');
    await user.click(screen.getByRole('button', { name: 'Submit revision' }));

    expect(reviseBudgetMock).toHaveBeenCalledWith('bud-1', {
      reason: 'Reforecast Q3 costs',
      lines: [{ budgetLineId: 'line-1', newAmount: 175000 }],
    });
  });

  it('submits every added change row, in order', async () => {
    reviseBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    await user.type(screen.getByLabelText('Reason'), 'Mid-year re-baseline');
    await fillChange(user, 1, 'line-1', '100000');
    await user.click(screen.getByRole('button', { name: '+ Add change' }));
    await fillChange(user, 2, 'line-2', '25000');
    await user.click(screen.getByRole('button', { name: 'Submit revision' }));

    expect(reviseBudgetMock).toHaveBeenCalledWith('bud-1', {
      reason: 'Mid-year re-baseline',
      lines: [
        { budgetLineId: 'line-1', newAmount: 100000 },
        { budgetLineId: 'line-2', newAmount: 25000 },
      ],
    });
  });

  it('shows the action-returned error message on failure', async () => {
    reviseBudgetMock.mockResolvedValue({ ok: false, error: 'A revision needs at least one changed line' });
    const user = userEvent.setup();
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    await user.type(screen.getByLabelText('Reason'), 'Reforecast');
    await fillChange(user, 1, 'line-1', '1000');
    await user.click(screen.getByRole('button', { name: 'Submit revision' }));

    expect(await screen.findByText('A revision needs at least one changed line')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    reviseBudgetMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    await user.type(screen.getByLabelText('Reason'), 'Reforecast');
    await fillChange(user, 1, 'line-1', '1000');
    await user.click(screen.getByRole('button', { name: 'Submit revision' }));

    expect(await screen.findByText('Failed to revise budget.')).toBeInTheDocument();
  });

  it('resets the reason and collapses back to a single blank row after a successful submit', async () => {
    reviseBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    await user.type(screen.getByLabelText('Reason'), 'Reforecast');
    await fillChange(user, 1, 'line-1', '1000');
    await user.click(screen.getByRole('button', { name: '+ Add change' }));
    await fillChange(user, 2, 'line-2', '2000');
    await user.click(screen.getByRole('button', { name: 'Submit revision' }));

    expect(await screen.findByLabelText('Reason')).toHaveValue('');
    expect(screen.queryByLabelText('Line (change 2)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Line (change 1)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    reviseBudgetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ReviseBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} />);

    await user.type(screen.getByLabelText('Reason'), 'Reforecast');
    await fillChange(user, 1, 'line-1', '1000');
    await user.click(screen.getByRole('button', { name: 'Submit revision' }));

    const pendingButton = screen.getByRole('button', { name: 'Revising…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Submit revision' })).not.toBeDisabled();
  });
});
