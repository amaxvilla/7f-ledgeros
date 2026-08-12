import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deactivateIpRuleMock = vi.fn();
vi.mock('../actions', () => ({
  deactivateIpRule: (...args: unknown[]) => deactivateIpRuleMock(...args),
}));

import { DeactivateIpRuleButton } from '../DeactivateIpRuleButton';

beforeEach(() => {
  deactivateIpRuleMock.mockReset();
});

describe('DeactivateIpRuleButton — visibility', () => {
  it('shows a Deactivate button when the rule is active', () => {
    render(<DeactivateIpRuleButton id="rule-1" isActive={true} />);

    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it('shows only a dash, no button, when the rule is already inactive', () => {
    render(<DeactivateIpRuleButton id="rule-1" isActive={false} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('DeactivateIpRuleButton — deactivate', () => {
  it('calls deactivateIpRule with the rule id when clicked', async () => {
    deactivateIpRuleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<DeactivateIpRuleButton id="rule-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(deactivateIpRuleMock).toHaveBeenCalledWith('rule-42');
  });

  it('shows the action-returned error message on failure', async () => {
    deactivateIpRuleMock.mockResolvedValue({ ok: false, error: 'IP restriction rule rule-42 not found' });
    const user = userEvent.setup();
    render(<DeactivateIpRuleButton id="rule-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('IP restriction rule rule-42 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    deactivateIpRuleMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<DeactivateIpRuleButton id="rule-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Failed to deactivate IP restriction rule.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    deactivateIpRuleMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<DeactivateIpRuleButton id="rule-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(screen.getByRole('button', { name: 'Deactivating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Deactivate' })).not.toBeDisabled();
  });

  it('re-enables the button after a failed attempt so the admin can retry', async () => {
    deactivateIpRuleMock.mockResolvedValue({ ok: false, error: 'Network error' });
    const user = userEvent.setup();
    render(<DeactivateIpRuleButton id="rule-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByRole('button', { name: 'Deactivate' })).not.toBeDisabled();
  });
});
