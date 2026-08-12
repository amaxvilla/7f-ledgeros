import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createInstallmentScheduleMock = vi.fn();
vi.mock('../actions', () => ({
  createInstallmentSchedule: (...args: unknown[]) => createInstallmentScheduleMock(...args),
}));

import { CreateInstallmentScheduleForm } from '../CreateInstallmentScheduleForm';

beforeEach(() => {
  createInstallmentScheduleMock.mockReset();
});

describe('CreateInstallmentScheduleForm', () => {
  it('renders a single installment row and the submit button by default', () => {
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    expect(screen.getByLabelText('Due date (installment 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount due (installment 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Due date (installment 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create installment schedule' })).toBeInTheDocument();
  });

  it('has no salePrice field anywhere on this form', () => {
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    expect(screen.queryByLabelText(/sale price/i)).not.toBeInTheDocument();
  });

  it('adds and removes installment rows, disabling Remove when only one remains', async () => {
    const user = userEvent.setup();
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '+ Add installment' }));
    expect(screen.getByLabelText('Due date (installment 2)')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).not.toBeDisabled();

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.queryByLabelText('Due date (installment 2)')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled();
  });

  it('submits a single-installment schedule with the correct payload shape', async () => {
    createInstallmentScheduleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    await user.type(screen.getByLabelText('Due date (installment 1)'), '2026-09-01');
    await user.type(screen.getByLabelText('Amount due (installment 1)'), '5000000');
    await user.click(screen.getByRole('button', { name: 'Create installment schedule' }));

    expect(createInstallmentScheduleMock).toHaveBeenCalledWith('unit-1', 'alloc-1', [
      { dueDate: '2026-09-01', amountDue: 5000000 },
    ]);
  });

  it('submits a multi-installment schedule with numeric amountDue conversion', async () => {
    createInstallmentScheduleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    await user.type(screen.getByLabelText('Due date (installment 1)'), '2026-09-01');
    await user.type(screen.getByLabelText('Amount due (installment 1)'), '5000000');
    await user.click(screen.getByRole('button', { name: '+ Add installment' }));
    await user.type(screen.getByLabelText('Due date (installment 2)'), '2026-10-01');
    await user.type(screen.getByLabelText('Amount due (installment 2)'), '5000000');
    await user.click(screen.getByRole('button', { name: 'Create installment schedule' }));

    expect(createInstallmentScheduleMock).toHaveBeenCalledWith('unit-1', 'alloc-1', [
      { dueDate: '2026-09-01', amountDue: 5000000 },
      { dueDate: '2026-10-01', amountDue: 5000000 },
    ]);
  });

  it('shows the action-returned error message on failure', async () => {
    createInstallmentScheduleMock.mockResolvedValue({
      ok: false,
      error: 'Installment total (5000000) does not match the sale price (10000000)',
    });
    const user = userEvent.setup();
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    await user.type(screen.getByLabelText('Due date (installment 1)'), '2026-09-01');
    await user.type(screen.getByLabelText('Amount due (installment 1)'), '5000000');
    await user.click(screen.getByRole('button', { name: 'Create installment schedule' }));

    expect(
      await screen.findByText('Installment total (5000000) does not match the sale price (10000000)'),
    ).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createInstallmentScheduleMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    await user.type(screen.getByLabelText('Due date (installment 1)'), '2026-09-01');
    await user.type(screen.getByLabelText('Amount due (installment 1)'), '5000000');
    await user.click(screen.getByRole('button', { name: 'Create installment schedule' }));

    expect(await screen.findByText('Failed to create installment schedule.')).toBeInTheDocument();
  });

  it('resets back to a single blank row after a successful submit', async () => {
    createInstallmentScheduleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    await user.click(screen.getByRole('button', { name: '+ Add installment' }));
    await user.type(screen.getByLabelText('Due date (installment 1)'), '2026-09-01');
    await user.type(screen.getByLabelText('Amount due (installment 1)'), '5000000');
    await user.type(screen.getByLabelText('Due date (installment 2)'), '2026-10-01');
    await user.type(screen.getByLabelText('Amount due (installment 2)'), '5000000');
    await user.click(screen.getByRole('button', { name: 'Create installment schedule' }));

    expect(await screen.findByLabelText('Due date (installment 1)')).toHaveValue('');
    expect(screen.queryByLabelText('Due date (installment 2)')).not.toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createInstallmentScheduleMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateInstallmentScheduleForm unitId="unit-1" allocationId="alloc-1" />);

    await user.type(screen.getByLabelText('Due date (installment 1)'), '2026-09-01');
    await user.type(screen.getByLabelText('Amount due (installment 1)'), '5000000');
    await user.click(screen.getByRole('button', { name: 'Create installment schedule' }));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create installment schedule' })).not.toBeDisabled();
  });
});
