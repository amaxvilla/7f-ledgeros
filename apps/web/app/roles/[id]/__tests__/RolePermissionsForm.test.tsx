import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setRolePermissionsMock = vi.fn();
vi.mock('../actions', () => ({
  setRolePermissions: (...args: unknown[]) => setRolePermissionsMock(...args),
}));

import { RolePermissionsForm } from '../RolePermissionsForm';

const ALL_PERMISSIONS = [
  { id: 'p1', code: 'gl.journal.post', module: 'GL', description: 'Post journal entries' },
  { id: 'p2', code: 'gl.journal.view', module: 'GL', description: null },
  { id: 'p3', code: 'ar.manage', module: 'AR', description: 'Manage AR invoices' },
];

beforeEach(() => {
  setRolePermissionsMock.mockReset();
});

describe('RolePermissionsForm — rendering', () => {
  it('renders every permission grouped by module', () => {
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={[]} />);

    expect(screen.getByText('GL')).toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.getByText('gl.journal.post')).toBeInTheDocument();
    expect(screen.getByText('gl.journal.view')).toBeInTheDocument();
    expect(screen.getByText('ar.manage')).toBeInTheDocument();
  });

  it('pre-checks exactly the permissions passed as initiallyChecked', () => {
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={['gl.journal.view']} />);

    expect(screen.getByRole('checkbox', { name: /gl\.journal\.post/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /gl\.journal\.view/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /ar\.manage/ })).not.toBeChecked();
  });

  it('shows the Save button', () => {
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={[]} />);

    expect(screen.getByRole('button', { name: 'Save permissions' })).toBeInTheDocument();
  });
});

describe('RolePermissionsForm — toggling', () => {
  it('checking a box adds it to the submitted set', async () => {
    setRolePermissionsMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={[]} />);

    await user.click(screen.getByRole('checkbox', { name: /gl\.journal\.post/ }));
    await user.click(screen.getByRole('button', { name: 'Save permissions' }));

    expect(setRolePermissionsMock).toHaveBeenCalledWith('role-1', ['gl.journal.post']);
  });

  it('unchecking a pre-checked box removes it from the submitted set', async () => {
    setRolePermissionsMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={['gl.journal.post', 'ar.manage']} />,
    );

    await user.click(screen.getByRole('checkbox', { name: /gl\.journal\.post/ }));
    await user.click(screen.getByRole('button', { name: 'Save permissions' }));

    expect(setRolePermissionsMock).toHaveBeenCalledWith('role-1', ['ar.manage']);
  });
});

describe('RolePermissionsForm — save', () => {
  it('shows a Saved confirmation on success', async () => {
    setRolePermissionsMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save permissions' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('shows the action-returned error message on failure', async () => {
    setRolePermissionsMock.mockResolvedValue({ ok: false, error: 'Unknown permission code(s): bogus.code' });
    const user = userEvent.setup();
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save permissions' }));

    expect(await screen.findByText('Unknown permission code(s): bogus.code')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    setRolePermissionsMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save permissions' }));

    expect(await screen.findByText('Failed to save permissions.')).toBeInTheDocument();
  });

  it('clears a prior Saved confirmation once a checkbox is toggled again', async () => {
    setRolePermissionsMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save permissions' }));
    await screen.findByText('Saved.');
    await user.click(screen.getByRole('checkbox', { name: /ar\.manage/ }));

    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('disables the Save button and shows the pending label while saving', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    setRolePermissionsMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RolePermissionsForm roleId="role-1" allPermissions={ALL_PERMISSIONS} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save permissions' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Save permissions' })).not.toBeDisabled();
  });
});
