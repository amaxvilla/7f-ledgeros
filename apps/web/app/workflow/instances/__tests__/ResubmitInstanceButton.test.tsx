import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const resubmitWorkflowInstanceMock = vi.fn();
vi.mock('../actions', () => ({
  resubmitWorkflowInstance: (...args: unknown[]) => resubmitWorkflowInstanceMock(...args),
}));

import { ResubmitInstanceButton } from '../ResubmitInstanceButton';

beforeEach(() => {
  resubmitWorkflowInstanceMock.mockReset();
});

describe('ResubmitInstanceButton', () => {
  it('renders a Resubmit button', () => {
    render(<ResubmitInstanceButton instanceId="inst-1" />);

    expect(screen.getByRole('button', { name: 'Resubmit' })).toBeInTheDocument();
  });

  it('calls resubmitWorkflowInstance with the instanceId when clicked', async () => {
    resubmitWorkflowInstanceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ResubmitInstanceButton instanceId="inst-42" />);

    await user.click(screen.getByRole('button', { name: 'Resubmit' }));

    expect(resubmitWorkflowInstanceMock).toHaveBeenCalledWith('inst-42');
  });

  it('shows the action-returned error message on failure', async () => {
    resubmitWorkflowInstanceMock.mockResolvedValue({ ok: false, error: 'Only a RETURNED instance can be resubmitted' });
    const user = userEvent.setup();
    render(<ResubmitInstanceButton instanceId="inst-42" />);

    await user.click(screen.getByRole('button', { name: 'Resubmit' }));

    expect(await screen.findByText('Only a RETURNED instance can be resubmitted')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    resubmitWorkflowInstanceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ResubmitInstanceButton instanceId="inst-42" />);

    await user.click(screen.getByRole('button', { name: 'Resubmit' }));

    expect(await screen.findByText('Failed to resubmit workflow instance.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    resubmitWorkflowInstanceMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ResubmitInstanceButton instanceId="inst-42" />);

    await user.click(screen.getByRole('button', { name: 'Resubmit' }));
    expect(screen.getByRole('button', { name: 'Resubmitting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Resubmit' })).not.toBeDisabled();
  });
});
