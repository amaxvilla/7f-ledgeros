import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setUserRolesMock = vi.fn();
vi.mock('../actions', () => ({
  setUserRoles: (...args: unknown[]) => setUserRolesMock(...args),
}));

import { UserRolesForm } from '../UserRolesForm';

const ALL_ROLES = [
  { id: 'role-1', code: 'FINANCE_MANAGER', name: 'Finance Manager' },
  { id: 'role-2', code: 'PMO_LEAD', name: 'PMO Lead' },
  { id: 'role-3', code: 'AUDITOR', name: 'Auditor' },
];

beforeEach(() => {
  setUserRolesMock.mockReset();
});

describe('UserRolesForm — rendering', () => {
  it('renders every role as a flat, ungrouped checkbox list', () => {
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={[]} />);

    expect(screen.getByText('FINANCE_MANAGER')).toBeInTheDocument();
    expect(screen.getByText('PMO_LEAD')).toBeInTheDocument();
    expect(screen.getByText('AUDITOR')).toBeInTheDocument();
    expect(screen.getByText('— Finance Manager')).toBeInTheDocument();
  });

  it('pre-checks exactly the roles passed as initiallyChecked, by id', () => {
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={['role-2']} />);

    expect(screen.getByRole('checkbox', { name: /FINANCE_MANAGER/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /PMO_LEAD/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /AUDITOR/ })).not.toBeChecked();
  });

  it('shows the Save button', () => {
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={[]} />);

    expect(screen.getByRole('button', { name: 'Save roles' })).toBeInTheDocument();
  });
});

describe('UserRolesForm — toggling', () => {
  it('checking a box adds its role id to the submitted set', async () => {
    setUserRolesMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={[]} />);

    await user.click(screen.getByRole('checkbox', { name: /FINANCE_MANAGER/ }));
    await user.click(screen.getByRole('button', { name: 'Save roles' }));

    expect(setUserRolesMock).toHaveBeenCalledWith('user-1', ['role-1']);
  });

  it('unchecking a pre-checked box removes its role id from the submitted set', async () => {
    setUserRolesMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={['role-1', 'role-3']} />);

    await user.click(screen.getByRole('checkbox', { name: /FINANCE_MANAGER/ }));
    await user.click(screen.getByRole('button', { name: 'Save roles' }));

    expect(setUserRolesMock).toHaveBeenCalledWith('user-1', ['role-3']);
  });
});

describe('UserRolesForm — save', () => {
  it('shows a Saved confirmation on success', async () => {
    setUserRolesMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save roles' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('shows the action-returned error message on failure', async () => {
    setUserRolesMock.mockResolvedValue({ ok: false, error: 'Unknown role id(s): bogus-id' });
    const user = userEvent.setup();
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save roles' }));

    expect(await screen.findByText('Unknown role id(s): bogus-id')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    setUserRolesMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save roles' }));

    expect(await screen.findByText('Failed to save roles.')).toBeInTheDocument();
  });

  it('clears a prior Saved confirmation once a checkbox is toggled again', async () => {
    setUserRolesMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save roles' }));
    await screen.findByText('Saved.');
    await user.click(screen.getByRole('checkbox', { name: /AUDITOR/ }));

    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('disables the Save button and shows the pending label while saving', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    setUserRolesMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<UserRolesForm userId="user-1" allRoles={ALL_ROLES} initiallyChecked={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save roles' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Save roles' })).not.toBeDisabled();
  });
});
