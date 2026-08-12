import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const transferBudgetMock = vi.fn();
vi.mock('../../actions', () => ({
  transferBudget: (...args: unknown[]) => transferBudgetMock(...args),
}));

import { TransferBudgetForm } from '../TransferBudgetForm';

const LINE_OPTIONS = [
  { value: 'line-1', label: '5000 — Construction Costs · Month 1' },
  { value: 'line-2', label: '5100 — Professional Fees · Month 6' },
];

const AVAILABLE = new Map([
  ['line-1', 50000],
  ['line-2', 12000],
]);

beforeEach(() => {
  transferBudgetMock.mockReset();
});

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  from: string,
  to: string,
  amount: string,
  reason: string,
) {
  await user.selectOptions(screen.getByLabelText('From line'), from);
  await user.selectOptions(screen.getByLabelText('To line'), to);
  await user.type(screen.getByLabelText('Amount'), amount);
  await user.type(screen.getByLabelText('Reason'), reason);
}

describe('TransferBudgetForm', () => {
  it('renders From line, To line, Amount, and Reason fields', () => {
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    expect(screen.getByLabelText('From line')).toBeInTheDocument();
    expect(screen.getByLabelText('To line')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit transfer' })).toBeInTheDocument();
  });

  it('populates both line Selects from the lineOptions prop', () => {
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    const options = screen.getAllByRole('option', { name: '5000 — Construction Costs · Month 1' });
    expect(options).toHaveLength(2);
  });

  it('marks every field as required', () => {
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    expect(screen.getByLabelText('From line')).toBeRequired();
    expect(screen.getByLabelText('To line')).toBeRequired();
    expect(screen.getByLabelText('Amount')).toBeRequired();
    expect(screen.getByLabelText('Reason')).toBeRequired();
  });

  it('shows the available amount for the selected From line', async () => {
    const user = userEvent.setup();
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    expect(screen.queryByText(/Available:/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('From line'), 'line-1');

    expect(await screen.findByText(/Available:/)).toBeInTheDocument();
  });

  it('blocks submission with an inline error when From and To are the same line, without calling the action', async () => {
    const user = userEvent.setup();
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    await fillForm(user, 'line-1', 'line-1', '1000', 'Reallocate');
    await user.click(screen.getByRole('button', { name: 'Submit transfer' }));

    expect(await screen.findByText('The from-line and to-line must be different.')).toBeInTheDocument();
    expect(transferBudgetMock).not.toHaveBeenCalled();
  });

  it('submits a payload with a numeric amount', async () => {
    transferBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    await fillForm(user, 'line-1', 'line-2', '5000', 'Reallocate to professional fees');
    await user.click(screen.getByRole('button', { name: 'Submit transfer' }));

    expect(transferBudgetMock).toHaveBeenCalledWith('bud-1', {
      fromLineId: 'line-1',
      toLineId: 'line-2',
      amount: 5000,
      reason: 'Reallocate to professional fees',
    });
  });

  it('shows the action-returned error message on failure', async () => {
    transferBudgetMock.mockResolvedValue({ ok: false, error: 'Insufficient available budget on the source line' });
    const user = userEvent.setup();
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    await fillForm(user, 'line-1', 'line-2', '999999', 'Reallocate');
    await user.click(screen.getByRole('button', { name: 'Submit transfer' }));

    expect(await screen.findByText('Insufficient available budget on the source line')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    transferBudgetMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    await fillForm(user, 'line-1', 'line-2', '1000', 'Reallocate');
    await user.click(screen.getByRole('button', { name: 'Submit transfer' }));

    expect(await screen.findByText('Failed to transfer budget.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    transferBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    await fillForm(user, 'line-1', 'line-2', '1000', 'Reallocate');
    await user.click(screen.getByRole('button', { name: 'Submit transfer' }));

    expect(await screen.findByLabelText('From line')).toHaveValue('');
    expect(screen.getByLabelText('To line')).toHaveValue('');
    expect(screen.getByLabelText('Amount')).toHaveValue(null);
    expect(screen.getByLabelText('Reason')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    transferBudgetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TransferBudgetForm budgetId="bud-1" lineOptions={LINE_OPTIONS} availableByLineId={AVAILABLE} />);

    await fillForm(user, 'line-1', 'line-2', '1000', 'Reallocate');
    await user.click(screen.getByRole('button', { name: 'Submit transfer' }));

    const pendingButton = screen.getByRole('button', { name: 'Transferring…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Submit transfer' })).not.toBeDisabled();
  });
});
