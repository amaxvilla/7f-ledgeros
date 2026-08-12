import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const addDependencyMock = vi.fn();
vi.mock('../actions', () => ({
  addDependency: (...args: unknown[]) => addDependencyMock(...args),
}));

import { AddDependencyForm } from '../AddDependencyForm';

const TASK_OPTIONS = [
  { value: 'task-1', label: 'T-001 — Foundation works' },
  { value: 'task-2', label: 'T-002 — Framing' },
];

beforeEach(() => {
  addDependencyMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Predecessor task'), 'task-1');
  await user.selectOptions(screen.getByLabelText('Successor task'), 'task-2');
}

describe('AddDependencyForm', () => {
  it('renders every field', () => {
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    expect(screen.getByLabelText('Predecessor task')).toBeInTheDocument();
    expect(screen.getByLabelText('Successor task')).toBeInTheDocument();
    expect(screen.getByLabelText('Type (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Lag days (optional)')).toBeInTheDocument();
  });

  it('marks Predecessor/Successor task as required, and Type/Lag days as not required', () => {
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    expect(screen.getByLabelText('Predecessor task')).toBeRequired();
    expect(screen.getByLabelText('Successor task')).toBeRequired();
    expect(screen.getByLabelText('Type (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Lag days (optional)')).not.toBeRequired();
  });

  it('submits the entered values, omitting type/lagDays as undefined when left blank', async () => {
    addDependencyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(addDependencyMock).toHaveBeenCalledWith({
      predecessorId: 'task-1',
      successorId: 'task-2',
      type: undefined,
      lagDays: undefined,
    });
  });

  it('includes type and lagDays, with numeric conversion, when filled in', async () => {
    addDependencyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText('Type (optional)'), 'START_TO_START');
    await user.type(screen.getByLabelText('Lag days (optional)'), '3');
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(addDependencyMock).toHaveBeenCalledWith({
      predecessorId: 'task-1',
      successorId: 'task-2',
      type: 'START_TO_START',
      lagDays: 3,
    });
  });

  it('shows a success message after a successful submission', async () => {
    addDependencyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(await screen.findByText('Dependency added.')).toBeInTheDocument();
  });

  it('shows the action-returned error message on failure', async () => {
    addDependencyMock.mockResolvedValue({ ok: false, error: 'This dependency would create a cycle in the task network' });
    const user = userEvent.setup();
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(await screen.findByText('This dependency would create a cycle in the task network')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    addDependencyMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(await screen.findByText('Failed to add dependency.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    addDependencyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Lag days (optional)'), '3');
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(await screen.findByLabelText('Predecessor task')).toHaveValue('');
    expect(screen.getByLabelText('Successor task')).toHaveValue('');
    expect(screen.getByLabelText('Lag days (optional)')).toHaveValue(null);
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    addDependencyMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<AddDependencyForm taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add dependency' })).not.toBeDisabled();
  });
});
