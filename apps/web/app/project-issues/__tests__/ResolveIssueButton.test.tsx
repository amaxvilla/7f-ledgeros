import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const resolveIssueMock = vi.fn();
vi.mock('../actions', () => ({
  resolveIssue: (...args: unknown[]) => resolveIssueMock(...args),
}));

import { ResolveIssueButton } from '../ResolveIssueButton';

beforeEach(() => {
  resolveIssueMock.mockReset();
});

describe('ResolveIssueButton', () => {
  it('shows a Resolve button for an OPEN issue', () => {
    render(<ResolveIssueButton id="issue-1" status="OPEN" />);

    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
  });

  it('shows a Resolve button for an ESCALATED issue', () => {
    render(<ResolveIssueButton id="issue-1" status="ESCALATED" />);

    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
  });

  it('shows no button, just a dash, for an already-RESOLVED issue', () => {
    render(<ResolveIssueButton id="issue-1" status="RESOLVED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for an already-CLOSED issue', () => {
    render(<ResolveIssueButton id="issue-1" status="CLOSED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls resolveIssue with the issue id when clicked', async () => {
    resolveIssueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ResolveIssueButton id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(resolveIssueMock).toHaveBeenCalledWith('issue-42');
  });

  it('shows the action-returned error message on failure', async () => {
    resolveIssueMock.mockResolvedValue({ ok: false, error: 'This issue is already CLOSED' });
    const user = userEvent.setup();
    render(<ResolveIssueButton id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(await screen.findByText('This issue is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    resolveIssueMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ResolveIssueButton id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(await screen.findByText('Failed to resolve issue.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    resolveIssueMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ResolveIssueButton id="issue-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(screen.getByRole('button', { name: 'Resolving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Resolve' })).not.toBeDisabled();
  });
});
