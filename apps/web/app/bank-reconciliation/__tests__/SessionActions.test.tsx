import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const autoMatchSessionMock = vi.fn();
const approveSessionMock = vi.fn();

vi.mock('../actions', () => ({
  autoMatchSession: (...args: unknown[]) => autoMatchSessionMock(...args),
  approveSession: (...args: unknown[]) => approveSessionMock(...args),
}));

import { SessionActions } from '../SessionActions';

beforeEach(() => {
  autoMatchSessionMock.mockReset();
  approveSessionMock.mockReset();
});

describe('SessionActions', () => {
  it('shows "Auto-match" and "Approve session" for a DRAFT session', () => {
    render(<SessionActions sessionId="sess-1" status="DRAFT" />);
    expect(screen.getByRole('button', { name: 'Auto-match' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve session' })).toBeInTheDocument();
  });

  it('shows a read-only message and no buttons for an APPROVED session', () => {
    render(<SessionActions sessionId="sess-1" status="APPROVED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Session is approved — no further changes.')).toBeInTheDocument();
  });

  it('calls autoMatchSession when "Auto-match" is clicked', async () => {
    autoMatchSessionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SessionActions sessionId="sess-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Auto-match' }));

    expect(autoMatchSessionMock).toHaveBeenCalledWith('sess-42');
  });

  it('calls approveSession when "Approve session" is clicked', async () => {
    approveSessionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SessionActions sessionId="sess-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Approve session' }));

    expect(approveSessionMock).toHaveBeenCalledWith('sess-42');
  });

  it('shows an error message when an action fails', async () => {
    approveSessionMock.mockResolvedValue({ ok: false, error: 'Cannot approve a session with unmatched lines.' });
    const user = userEvent.setup();
    render(<SessionActions sessionId="sess-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Approve session' }));

    expect(await screen.findByText('Cannot approve a session with unmatched lines.')).toBeInTheDocument();
  });
});
