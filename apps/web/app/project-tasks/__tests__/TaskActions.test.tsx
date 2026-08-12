import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateTaskProgressMock = vi.fn();
const setTaskStatusMock = vi.fn();

vi.mock('../actions', () => ({
  updateTaskProgress: (...args: unknown[]) => updateTaskProgressMock(...args),
  setTaskStatus: (...args: unknown[]) => setTaskStatusMock(...args),
}));

import { TaskActions } from '../TaskActions';

beforeEach(() => {
  updateTaskProgressMock.mockReset();
  setTaskStatusMock.mockReset();
});

describe('TaskActions', () => {
  it('renders both the progress control and the status control for a NOT_STARTED task', () => {
    render(<TaskActions id="task-1" status="NOT_STARTED" />);

    expect(screen.getByRole('button', { name: '% complete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '% complete' })).not.toBeDisabled();
  });

  it('disables the progress control but not the status control for a CANCELLED task', () => {
    render(<TaskActions id="task-1" status="CANCELLED" />);

    expect(screen.getByRole('button', { name: '% complete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set status' })).not.toBeDisabled();
  });

  it('calls updateTaskProgress with the entered percentage', async () => {
    updateTaskProgressMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const { container } = render(<TaskActions id="task-42" status="IN_PROGRESS" />);

    const percentInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    await user.clear(percentInput);
    await user.type(percentInput, '50');
    await user.click(screen.getByRole('button', { name: '% complete' }));

    expect(updateTaskProgressMock).toHaveBeenCalledWith('task-42', { percentComplete: 50 });
  });

  it('shows the action-returned error message when updateTaskProgress fails', async () => {
    updateTaskProgressMock.mockResolvedValue({ ok: false, error: 'Cannot update progress on a CANCELLED task' });
    const user = userEvent.setup();
    render(<TaskActions id="task-42" status="IN_PROGRESS" />);

    await user.click(screen.getByRole('button', { name: '% complete' }));

    expect(await screen.findByText('Cannot update progress on a CANCELLED task')).toBeInTheDocument();
  });

  it('falls back to a generic error message when updateTaskProgress fails without one', async () => {
    updateTaskProgressMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<TaskActions id="task-42" status="IN_PROGRESS" />);

    await user.click(screen.getByRole('button', { name: '% complete' }));

    expect(await screen.findByText('Failed to update task progress.')).toBeInTheDocument();
  });

  it('disables both controls and shows the pending label while updateTaskProgress is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    updateTaskProgressMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TaskActions id="task-42" status="IN_PROGRESS" />);

    await user.click(screen.getByRole('button', { name: '% complete' }));
    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set status' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: '% complete' })).not.toBeDisabled();
  });

  it('calls setTaskStatus with the selected status', async () => {
    setTaskStatusMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const { container } = render(<TaskActions id="task-42" status="IN_PROGRESS" />);

    const statusSelect = container.querySelector('select') as HTMLSelectElement;
    await user.selectOptions(statusSelect, 'ON_HOLD');
    await user.click(screen.getByRole('button', { name: 'Set status' }));

    expect(setTaskStatusMock).toHaveBeenCalledWith('task-42', 'ON_HOLD');
  });

  it('shows the action-returned error message when setTaskStatus fails', async () => {
    setTaskStatusMock.mockResolvedValue({ ok: false, error: 'Task task-42 not found' });
    const user = userEvent.setup();
    render(<TaskActions id="task-42" status="IN_PROGRESS" />);

    await user.click(screen.getByRole('button', { name: 'Set status' }));

    expect(await screen.findByText('Task task-42 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when setTaskStatus fails without one', async () => {
    setTaskStatusMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<TaskActions id="task-42" status="IN_PROGRESS" />);

    await user.click(screen.getByRole('button', { name: 'Set status' }));

    expect(await screen.findByText('Failed to set task status.')).toBeInTheDocument();
  });

  it('disables both controls and shows the pending label while setTaskStatus is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    setTaskStatusMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TaskActions id="task-42" status="IN_PROGRESS" />);

    await user.click(screen.getByRole('button', { name: 'Set status' }));
    expect(screen.getByRole('button', { name: 'Setting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '% complete' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Set status' })).not.toBeDisabled();
  });
});
