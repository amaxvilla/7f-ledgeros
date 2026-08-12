import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createTaskMock = vi.fn();
vi.mock('../actions', () => ({
  createTask: (...args: unknown[]) => createTaskMock(...args),
}));

import { CreateTaskForm } from '../CreateTaskForm';

const TASK_OPTIONS = [{ value: 'task-1', label: 'T-001 — Foundation works' }];

beforeEach(() => {
  createTaskMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Site clearance');
  await user.type(screen.getByLabelText('Planned start'), '2026-08-01');
  await user.type(screen.getByLabelText('Planned end'), '2026-08-15');
}

describe('CreateTaskForm', () => {
  it('renders every field', () => {
    render(<CreateTaskForm entityId="ent-1" projectId="proj-1" taskOptions={TASK_OPTIONS} />);

    expect(screen.getByLabelText('Code (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Parent task (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Planned start')).toBeInTheDocument();
    expect(screen.getByLabelText('Planned end')).toBeInTheDocument();
    expect(screen.getByLabelText('Budgeted cost (optional)')).toBeInTheDocument();
  });

  it('marks Code/Parent task/Budgeted cost as not required, and the rest as required', () => {
    render(<CreateTaskForm entityId="ent-1" projectId="proj-1" taskOptions={TASK_OPTIONS} />);

    expect(screen.getByLabelText('Code (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Parent task (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Budgeted cost (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Planned start')).toBeRequired();
    expect(screen.getByLabelText('Planned end')).toBeRequired();
  });

  it('submits entityId, projectId, and the entered values, omitting optional fields as undefined when blank', async () => {
    createTaskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTaskForm entityId="ent-1" projectId="proj-1" taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(createTaskMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      projectId: 'proj-1',
      parentTaskId: undefined,
      code: undefined,
      name: 'Site clearance',
      plannedStart: '2026-08-01',
      plannedEnd: '2026-08-15',
      budgetedCost: undefined,
    });
  });

  it('includes optional fields, with numeric conversion for budgetedCost, when filled in', async () => {
    createTaskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTaskForm entityId="ent-1" projectId="proj-1" taskOptions={TASK_OPTIONS} />);

    await user.type(screen.getByLabelText('Code (optional)'), 'T-002');
    await user.selectOptions(screen.getByLabelText('Parent task (optional)'), 'task-1');
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Budgeted cost (optional)'), '25000');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(createTaskMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      projectId: 'proj-1',
      parentTaskId: 'task-1',
      code: 'T-002',
      name: 'Site clearance',
      plannedStart: '2026-08-01',
      plannedEnd: '2026-08-15',
      budgetedCost: 25000,
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createTaskMock.mockResolvedValue({ ok: false, error: 'plannedEnd cannot be before plannedStart' });
    const user = userEvent.setup();
    render(<CreateTaskForm entityId="ent-1" projectId="proj-1" taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(await screen.findByText('plannedEnd cannot be before plannedStart')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Site clearance');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createTaskMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateTaskForm entityId="ent-1" projectId="proj-1" taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(await screen.findByText('Failed to create task.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createTaskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTaskForm entityId="ent-1" projectId="proj-1" taskOptions={TASK_OPTIONS} />);

    await user.type(screen.getByLabelText('Code (optional)'), 'T-002');
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(await screen.findByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Code (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Planned start')).toHaveValue('');
    expect(screen.getByLabelText('Planned end')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createTaskMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateTaskForm entityId="ent-1" projectId="proj-1" taskOptions={TASK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add task' })).not.toBeDisabled();
  });
});
