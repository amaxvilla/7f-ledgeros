import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const assignIssueMock = vi.fn();
const startIssueWorkMock = vi.fn();
const escalateIssueMock = vi.fn();
vi.mock('../actions', () => ({
  assignIssue: (...args: unknown[]) => assignIssueMock(...args),
  startIssueWork: (...args: unknown[]) => startIssueWorkMock(...args),
  escalateIssue: (...args: unknown[]) => escalateIssueMock(...args),
}));

import { IssueRowActions } from '../IssueRowActions';

beforeEach(() => {
  assignIssueMock.mockReset();
  startIssueWorkMock.mockReset();
  escalateIssueMock.mockReset();
});

describe('IssueRowActions — visibility', () => {
  it('shows Assign, Start work, and Escalate for an OPEN issue', () => {
    render(<IssueRowActions id="issue-1" status="OPEN" />);

    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start work' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escalate' })).toBeInTheDocument();
  });

  it('hides Start work for an IN_PROGRESS issue, but keeps Assign and Escalate', () => {
    render(<IssueRowActions id="issue-1" status="IN_PROGRESS" />);

    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escalate' })).toBeInTheDocument();
  });

  it('hides both Start work and Escalate for an already-ESCALATED issue, but keeps Assign', () => {
    render(<IssueRowActions id="issue-1" status="ESCALATED" />);

    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Escalate' })).not.toBeInTheDocument();
  });

  it('hides Start work for a RESOLVED issue, keeps Assign and Escalate', () => {
    render(<IssueRowActions id="issue-1" status="RESOLVED" />);

    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escalate' })).toBeInTheDocument();
  });

  it('renders nothing for an already-CLOSED issue', () => {
    const { container } = render(<IssueRowActions id="issue-1" status="CLOSED" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('IssueRowActions — assign', () => {
  it('calls assignIssue with the issue id and typed user id on submit', async () => {
    assignIssueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.type(screen.getByLabelText('Assign to (user id)'), 'user-7');
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(assignIssueMock).toHaveBeenCalledWith('issue-42', 'user-7');
  });

  it('clears the input after a successful assign', async () => {
    assignIssueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    const input = screen.getByLabelText('Assign to (user id)');
    await user.type(input, 'user-7');
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(await screen.findByLabelText('Assign to (user id)')).toHaveValue('');
  });

  it('shows the action-returned error message when assign fails', async () => {
    assignIssueMock.mockResolvedValue({ ok: false, error: 'This issue is already CLOSED' });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.type(screen.getByLabelText('Assign to (user id)'), 'user-7');
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(await screen.findByText('This issue is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when assign fails without one', async () => {
    assignIssueMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.type(screen.getByLabelText('Assign to (user id)'), 'user-7');
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(await screen.findByText('Failed to assign issue.')).toBeInTheDocument();
  });

  it('disables the Assign button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    assignIssueMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.type(screen.getByLabelText('Assign to (user id)'), 'user-7');
    await user.click(screen.getByRole('button', { name: 'Assign' }));
    expect(screen.getByRole('button', { name: 'Assigning…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Assign' })).not.toBeDisabled();
  });
});

describe('IssueRowActions — start work', () => {
  it('calls startIssueWork with the issue id when clicked', async () => {
    startIssueWorkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start work' }));

    expect(startIssueWorkMock).toHaveBeenCalledWith('issue-42');
  });

  it('shows the action-returned error message when start fails', async () => {
    startIssueWorkMock.mockResolvedValue({ ok: false, error: 'This issue is already CLOSED' });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start work' }));

    expect(await screen.findByText('This issue is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when start fails without one', async () => {
    startIssueWorkMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start work' }));

    expect(await screen.findByText('Failed to start work on this issue.')).toBeInTheDocument();
  });

  it('disables the Start work button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    startIssueWorkMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Start work' }));
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Start work' })).not.toBeDisabled();
  });
});

describe('IssueRowActions — escalate', () => {
  it('calls escalateIssue with the issue id when clicked', async () => {
    escalateIssueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Escalate' }));

    expect(escalateIssueMock).toHaveBeenCalledWith('issue-42');
  });

  it('shows the action-returned error message when escalate fails', async () => {
    escalateIssueMock.mockResolvedValue({ ok: false, error: 'This issue is already CLOSED' });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Escalate' }));

    expect(await screen.findByText('This issue is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when escalate fails without one', async () => {
    escalateIssueMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Escalate' }));

    expect(await screen.findByText('Failed to escalate issue.')).toBeInTheDocument();
  });

  it('disables the Escalate button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    escalateIssueMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<IssueRowActions id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Escalate' }));
    expect(screen.getByRole('button', { name: 'Escalating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Escalate' })).not.toBeDisabled();
  });
});
