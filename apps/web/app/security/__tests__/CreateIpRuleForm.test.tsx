import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createIpRuleMock = vi.fn();
vi.mock('../actions', () => ({
  createIpRule: (...args: unknown[]) => createIpRuleMock(...args),
}));

import { CreateIpRuleForm } from '../CreateIpRuleForm';

beforeEach(() => {
  createIpRuleMock.mockReset();
});

describe('CreateIpRuleForm', () => {
  it('renders scope and cidr but not the userId field until a scope is chosen', () => {
    render(<CreateIpRuleForm />);

    expect(screen.getByLabelText('Scope')).toBeInTheDocument();
    expect(screen.getByLabelText('CIDR')).toBeInTheDocument();
    expect(screen.getByLabelText('Label (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
  });

  it('shows the required User ID field only after selecting scope=USER, and hides it again for GLOBAL', async () => {
    const user = userEvent.setup();
    render(<CreateIpRuleForm />);

    await user.selectOptions(screen.getByLabelText('Scope'), 'USER');
    expect(screen.getByLabelText('User ID')).toBeInTheDocument();
    expect(screen.getByLabelText('User ID')).toBeRequired();

    await user.selectOptions(screen.getByLabelText('Scope'), 'GLOBAL');
    expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
  });

  it('submits userId: undefined for a GLOBAL rule even if a userId was typed before switching scope back', async () => {
    createIpRuleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIpRuleForm />);

    await user.selectOptions(screen.getByLabelText('Scope'), 'USER');
    await user.type(screen.getByLabelText('User ID'), 'user-42');
    await user.selectOptions(screen.getByLabelText('Scope'), 'GLOBAL');
    await user.type(screen.getByLabelText('CIDR'), '203.0.113.0/24');
    await user.click(screen.getByRole('button', { name: 'Add IP rule' }));

    expect(createIpRuleMock).toHaveBeenCalledWith({
      scope: 'GLOBAL',
      cidr: '203.0.113.0/24',
      userId: undefined,
      label: undefined,
    });
  });

  it('submits the typed userId for a USER-scoped rule', async () => {
    createIpRuleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIpRuleForm />);

    await user.selectOptions(screen.getByLabelText('Scope'), 'USER');
    await user.type(screen.getByLabelText('User ID'), 'user-42');
    await user.type(screen.getByLabelText('CIDR'), '203.0.113.0/24');
    await user.type(screen.getByLabelText('Label (optional)'), 'Office VPN');
    await user.click(screen.getByRole('button', { name: 'Add IP rule' }));

    expect(createIpRuleMock).toHaveBeenCalledWith({
      scope: 'USER',
      cidr: '203.0.113.0/24',
      userId: 'user-42',
      label: 'Office VPN',
    });
  });

  it('shows the action-returned error message and keeps the entered values on failure', async () => {
    createIpRuleMock.mockResolvedValue({ ok: false, error: 'CIDR overlaps an existing rule' });
    const user = userEvent.setup();
    render(<CreateIpRuleForm />);

    await user.selectOptions(screen.getByLabelText('Scope'), 'GLOBAL');
    await user.type(screen.getByLabelText('CIDR'), '203.0.113.0/24');
    await user.click(screen.getByRole('button', { name: 'Add IP rule' }));

    expect(await screen.findByText('CIDR overlaps an existing rule')).toBeInTheDocument();
    expect(screen.getByLabelText('CIDR')).toHaveValue('203.0.113.0/24');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createIpRuleMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateIpRuleForm />);

    await user.selectOptions(screen.getByLabelText('Scope'), 'GLOBAL');
    await user.type(screen.getByLabelText('CIDR'), '203.0.113.0/24');
    await user.click(screen.getByRole('button', { name: 'Add IP rule' }));

    expect(await screen.findByText('Failed to create IP restriction rule.')).toBeInTheDocument();
  });

  it('resets every field, including collapsing the userId field, after a successful submit', async () => {
    createIpRuleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIpRuleForm />);

    await user.selectOptions(screen.getByLabelText('Scope'), 'USER');
    await user.type(screen.getByLabelText('User ID'), 'user-42');
    await user.type(screen.getByLabelText('CIDR'), '203.0.113.0/24');
    await user.click(screen.getByRole('button', { name: 'Add IP rule' }));

    expect(await screen.findByLabelText('CIDR')).toHaveValue('');
    // scope reset to '' collapses the conditional userId field entirely
    expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createIpRuleMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateIpRuleForm />);

    await user.selectOptions(screen.getByLabelText('Scope'), 'GLOBAL');
    await user.type(screen.getByLabelText('CIDR'), '203.0.113.0/24');
    await user.click(screen.getByRole('button', { name: 'Add IP rule' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add IP rule' })).not.toBeDisabled();
  });
});
