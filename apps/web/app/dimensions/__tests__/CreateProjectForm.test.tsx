import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createProjectMock = vi.fn();
vi.mock('../actions', () => ({
  createProject: (...args: unknown[]) => createProjectMock(...args),
}));

import { CreateProjectForm } from '../CreateProjectForm';

beforeEach(() => {
  createProjectMock.mockReset();
});

describe('CreateProjectForm', () => {
  it('renders every field', () => {
    render(<CreateProjectForm entityId="ent-1" />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add project' })).toBeInTheDocument();
  });

  it('submits entityId and the entered values to createProject', async () => {
    createProjectMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateProjectForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'PRJ-001');
    await user.type(screen.getByLabelText('Name'), 'Riverside Towers');
    await user.click(screen.getByRole('button', { name: 'Add project' }));

    expect(createProjectMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      code: 'PRJ-001',
      name: 'Riverside Towers',
      description: undefined,
    });
  });

  it('shows an error message when the action fails', async () => {
    createProjectMock.mockResolvedValue({ ok: false, error: 'Project code already exists.' });
    const user = userEvent.setup();
    render(<CreateProjectForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'PRJ-001');
    await user.type(screen.getByLabelText('Name'), 'Riverside Towers');
    await user.click(screen.getByRole('button', { name: 'Add project' }));

    expect(await screen.findByText('Project code already exists.')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createProjectMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateProjectForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'PRJ-001');
    await user.type(screen.getByLabelText('Name'), 'Riverside Towers');
    await user.click(screen.getByRole('button', { name: 'Add project' }));

    expect(await screen.findByText('Failed to create project.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createProjectMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateProjectForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'PRJ-001');
    await user.type(screen.getByLabelText('Name'), 'Riverside Towers');
    await user.type(screen.getByLabelText('Description (optional)'), 'A riverside residential tower');
    await user.click(screen.getByRole('button', { name: 'Add project' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createProjectMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateProjectForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Code'), 'PRJ-001');
    await user.type(screen.getByLabelText('Name'), 'Riverside Towers');
    await user.click(screen.getByRole('button', { name: 'Add project' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add project' })).not.toBeDisabled();
  });
});
