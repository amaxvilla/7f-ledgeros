import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const triggerBudgetRecalculationMock = vi.fn();
vi.mock('../actions', () => ({
  triggerBudgetRecalculation: (...args: unknown[]) => triggerBudgetRecalculationMock(...args),
}));

import { TriggerBudgetRecalculationForm } from '../TriggerBudgetRecalculationForm';

beforeEach(() => {
  triggerBudgetRecalculationMock.mockReset();
});

describe('TriggerBudgetRecalculationForm', () => {
  it('renders both optional fields and the submit button', () => {
    render(<TriggerBudgetRecalculationForm />);

    expect(screen.getByLabelText('Budget ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Entity ID (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trigger budget recalculation' })).toBeInTheDocument();
  });

  it('submits undefined for both fields when left blank', async () => {
    triggerBudgetRecalculationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerBudgetRecalculationForm />);

    await user.click(screen.getByRole('button', { name: 'Trigger budget recalculation' }));

    expect(triggerBudgetRecalculationMock).toHaveBeenCalledWith(undefined, undefined);
  });

  it('submits the entered budget and entity ids', async () => {
    triggerBudgetRecalculationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerBudgetRecalculationForm />);

    await user.type(screen.getByLabelText('Budget ID (optional)'), 'budget-1');
    await user.type(screen.getByLabelText('Entity ID (optional)'), 'ent-1');
    await user.click(screen.getByRole('button', { name: 'Trigger budget recalculation' }));

    expect(triggerBudgetRecalculationMock).toHaveBeenCalledWith('budget-1', 'ent-1');
  });

  it('shows a confirmation message on success', async () => {
    triggerBudgetRecalculationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerBudgetRecalculationForm />);

    await user.click(screen.getByRole('button', { name: 'Trigger budget recalculation' }));

    expect(await screen.findByText('Queued.')).toBeInTheDocument();
  });

  it('shows the returned error message on failure', async () => {
    triggerBudgetRecalculationMock.mockResolvedValue({ ok: false, error: 'Budget not found' });
    const user = userEvent.setup();
    render(<TriggerBudgetRecalculationForm />);

    await user.type(screen.getByLabelText('Budget ID (optional)'), 'bad-id');
    await user.click(screen.getByRole('button', { name: 'Trigger budget recalculation' }));

    expect(await screen.findByText('Budget not found')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    triggerBudgetRecalculationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TriggerBudgetRecalculationForm />);

    await user.click(screen.getByRole('button', { name: 'Trigger budget recalculation' }));

    expect(screen.getByRole('button', { name: 'Queuing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Trigger budget recalculation' })).not.toBeDisabled();
  });
});
