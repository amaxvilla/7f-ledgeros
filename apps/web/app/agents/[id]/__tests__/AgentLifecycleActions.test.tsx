import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const approveAgentMock = vi.fn();
const suspendAgentMock = vi.fn();
const reactivateAgentMock = vi.fn();
const terminateAgentMock = vi.fn();
vi.mock('../../actions', () => ({
  approveAgent: (...args: unknown[]) => approveAgentMock(...args),
  suspendAgent: (...args: unknown[]) => suspendAgentMock(...args),
  reactivateAgent: (...args: unknown[]) => reactivateAgentMock(...args),
  terminateAgent: (...args: unknown[]) => terminateAgentMock(...args),
}));

import { AgentLifecycleActions } from '../AgentLifecycleActions';

beforeEach(() => {
  approveAgentMock.mockReset();
  suspendAgentMock.mockReset();
  reactivateAgentMock.mockReset();
  terminateAgentMock.mockReset();
});

describe('AgentLifecycleActions', () => {
  it('shows only Approve (plus Terminate) for a PENDING_APPROVAL agent', () => {
    render(<AgentLifecycleActions agentId="agent-1" status="PENDING_APPROVAL" />);

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument();
  });

  it('shows only Suspend (plus Terminate) for an ACTIVE agent, requiring a reason', async () => {
    suspendAgentMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AgentLifecycleActions agentId="agent-1" status="ACTIVE" />);

    expect(screen.getByRole('button', { name: 'Suspend' })).toBeDisabled();
    await user.type(screen.getByLabelText('Suspend reason'), 'Compliance review');
    expect(screen.getByRole('button', { name: 'Suspend' })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(suspendAgentMock).toHaveBeenCalledWith('agent-1', 'Compliance review');
  });

  it('shows only Reactivate (plus Terminate) for a SUSPENDED agent', async () => {
    reactivateAgentMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AgentLifecycleActions agentId="agent-1" status="SUSPENDED" />);

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reactivate' }));
    expect(reactivateAgentMock).toHaveBeenCalledWith('agent-1');
  });

  it('renders no actions for a TERMINATED agent', () => {
    render(<AgentLifecycleActions agentId="agent-1" status="TERMINATED" />);

    expect(screen.getByText('Terminated — terminal, no further transitions.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('surfaces a server-side conflict error, e.g. an already-approved agent', async () => {
    approveAgentMock.mockResolvedValue({ ok: false, error: 'Agent agent-1 cannot be approved from status ACTIVE — only PENDING_APPROVAL agents can be approved' });
    const user = userEvent.setup();
    render(<AgentLifecycleActions agentId="agent-1" status="PENDING_APPROVAL" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Agent agent-1 cannot be approved from status ACTIVE — only PENDING_APPROVAL agents can be approved')).toBeInTheDocument();
  });
});
