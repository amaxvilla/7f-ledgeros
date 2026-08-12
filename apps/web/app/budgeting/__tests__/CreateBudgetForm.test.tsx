import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createBudgetMock = vi.fn();
vi.mock('../actions', () => ({
  createBudget: (...args: unknown[]) => createBudgetMock(...args),
}));

import { CreateBudgetForm } from '../CreateBudgetForm';

const ACCOUNT_OPTIONS = [
  { value: 'acc-1', label: '5000 — Construction Costs' },
  { value: 'acc-2', label: '5100 — Professional Fees' },
];

beforeEach(() => {
  createBudgetMock.mockReset();
});

async function fillHeaderFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Code'), 'BUD-2026-01');
  await user.type(screen.getByLabelText('Name'), 'FY2026 Operating Budget');
  await user.type(screen.getByLabelText('Fiscal year'), '2026');
}

async function fillLine(user: ReturnType<typeof userEvent.setup>, index: number, accountValue: string, period: string, amount: string) {
  await user.selectOptions(screen.getByLabelText(`Account (line ${index})`), accountValue);
  await user.selectOptions(screen.getByLabelText(`Period (line ${index})`), period);
  await user.type(screen.getByLabelText(`Amount (line ${index})`), amount);
}

describe('CreateBudgetForm', () => {
  it('renders every header field and a single line by default', () => {
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Fiscal year')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Account (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Period (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (line 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Account (line 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create budget' })).toBeInTheDocument();
  });

  it('lists all twelve months as period options', () => {
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'January' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'December' })).toBeInTheDocument();
  });

  it('populates the account Select from the accountOptions prop', () => {
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('option', { name: '5000 — Construction Costs' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '5100 — Professional Fees' })).toBeInTheDocument();
  });

  it('marks Code, Name, Fiscal year, and every line field as required, Description as optional', () => {
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Code')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Fiscal year')).toBeRequired();
    expect(screen.getByLabelText('Description (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Account (line 1)')).toBeRequired();
    expect(screen.getByLabelText('Period (line 1)')).toBeRequired();
    expect(screen.getByLabelText('Amount (line 1)')).toBeRequired();
  });

  it('adds a new, independently-fillable line when "+ Add line" is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add line' }));

    expect(screen.getByLabelText('Account (line 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Period (line 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (line 2)')).toBeInTheDocument();
  });

  it('removes a line when its own Remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    expect(screen.getByLabelText('Account (line 2)')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[1]);

    expect(screen.queryByLabelText('Account (line 2)')).not.toBeInTheDocument();
  });

  it('disables the only remaining line\'s Remove button — a budget always needs at least one line', () => {
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('submits a single-line payload with numeric fiscalYear/period/amount', async () => {
    createBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'acc-1', '3', '150000');
    await user.click(screen.getByRole('button', { name: 'Create budget' }));

    expect(createBudgetMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      code: 'BUD-2026-01',
      name: 'FY2026 Operating Budget',
      fiscalYear: 2026,
      description: undefined,
      lines: [{ accountId: 'acc-1', period: 3, amount: 150000 }],
    });
  });

  it('submits every added line, in order, plus the optional description when filled in', async () => {
    createBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Description (optional)'), 'Approved at Q4 planning session');
    await fillLine(user, 1, 'acc-1', '1', '100000');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, 'acc-2', '6', '25000');
    await user.click(screen.getByRole('button', { name: 'Create budget' }));

    expect(createBudgetMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      code: 'BUD-2026-01',
      name: 'FY2026 Operating Budget',
      fiscalYear: 2026,
      description: 'Approved at Q4 planning session',
      lines: [
        { accountId: 'acc-1', period: 1, amount: 100000 },
        { accountId: 'acc-2', period: 6, amount: 25000 },
      ],
    });
  });

  it('shows the action-returned error message on failure', async () => {
    createBudgetMock.mockResolvedValue({ ok: false, error: 'A budget needs at least one line' });
    const user = userEvent.setup();
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'acc-1', '1', '1000');
    await user.click(screen.getByRole('button', { name: 'Create budget' }));

    expect(await screen.findByText('A budget needs at least one line')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createBudgetMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'acc-1', '1', '1000');
    await user.click(screen.getByRole('button', { name: 'Create budget' }));

    expect(await screen.findByText('Failed to create budget.')).toBeInTheDocument();
  });

  it('resets header fields and collapses back to a single blank line after a successful submit', async () => {
    createBudgetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'acc-1', '1', '1000');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, 'acc-2', '2', '2000');
    await user.click(screen.getByRole('button', { name: 'Create budget' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Fiscal year')).toHaveValue(null);
    expect(screen.queryByLabelText('Account (line 2)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Account (line 1)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createBudgetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateBudgetForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'acc-1', '1', '1000');
    await user.click(screen.getByRole('button', { name: 'Create budget' }));

    const pendingButton = screen.getByRole('button', { name: 'Creating…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create budget' })).not.toBeDisabled();
  });
});
