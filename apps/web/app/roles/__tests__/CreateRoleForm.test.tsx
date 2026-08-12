import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createRoleMock = vi.fn();
vi.mock('../actions', () => ({
  createRole: (...args: unknown[]) => createRoleMock(...args),
}));

import { CreateRoleForm } from '../CreateRoleForm';

beforeEach(() => {
  createRoleMock.mockReset();
});

describe('CreateRoleForm — rendering', () => {
  it('renders Code, Name, and Description fields', () => {
    render(<CreateRoleForm />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create role' })).toBeInTheDocument();
  });

  it('marks Code and Name as required, Description as optional', () => {
    render(<CreateRoleForm />);

    expect(screen.getByLabelText('Code')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Description')).not.toBeRequired();
  });
});

describe('CreateRoleForm — submit', () => {
  it('submits entered values, omitting an empty optional description', async () => {
    createRoleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRoleForm />);

    await user.type(screen.getByLabelText('Code'), 'PROJECT_MANAGER');
    await user.type(screen.getByLabelText('Name'), 'Project Manager');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(createRoleMock).toHaveBeenCalledWith({
      code: 'PROJECT_MANAGER',
      name: 'Project Manager',
      description: undefined,
    });
  });

  it('includes the description when provided', async () => {
    createRoleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRoleForm />);

    await user.type(screen.getByLabelText('Code'), 'AUDITOR');
    await user.type(screen.getByLabelText('Name'), 'Auditor');
    await user.type(screen.getByLabelText('Description'), 'Read-only cross-module access');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(createRoleMock).toHaveBeenCalledWith({
      code: 'AUDITOR',
      name: 'Auditor',
      description: 'Read-only cross-module access',
    });
  });

  it('shows the action-returned error message on failure', async () => {
    createRoleMock.mockResolvedValue({ ok: false, error: 'Role code AUDITOR already exists' });
    const user = userEvent.setup();
    render(<CreateRoleForm />);

    await user.type(screen.getByLabelText('Code'), 'AUDITOR');
    await user.type(screen.getByLabelText('Name'), 'Auditor');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByText('Role code AUDITOR already exists')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createRoleMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateRoleForm />);

    await user.type(screen.getByLabelText('Code'), 'AUDITOR');
    await user.type(screen.getByLabelText('Name'), 'Auditor');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByText('Failed to create role.')).toBeInTheDocument();
  });

  it('resets all fields after a successful submit', async () => {
    createRoleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRoleForm />);

    await user.type(screen.getByLabelText('Code'), 'AUDITOR');
    await user.type(screen.getByLabelText('Name'), 'Auditor');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('does not reset fields on failure', async () => {
    createRoleMock.mockResolvedValue({ ok: false, error: 'Role code AUDITOR already exists' });
    const user = userEvent.setup();
    render(<CreateRoleForm />);

    await user.type(screen.getByLabelText('Code'), 'AUDITOR');
    await user.type(screen.getByLabelText('Name'), 'Auditor');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    await screen.findByText('Role code AUDITOR already exists');
    expect(screen.getByLabelText('Code')).toHaveValue('AUDITOR');
  });

  it('disables the submit button and shows the pending label while submitting', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createRoleMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateRoleForm />);

    await user.type(screen.getByLabelText('Code'), 'AUDITOR');
    await user.type(screen.getByLabelText('Name'), 'Auditor');
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create role' })).not.toBeDisabled();
  });
});
