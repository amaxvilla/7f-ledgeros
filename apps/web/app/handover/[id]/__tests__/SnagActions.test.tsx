import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const startSnagMock = vi.fn();
const resolveSnagMock = vi.fn();
const verifySnagMock = vi.fn();
const rejectSnagMock = vi.fn();
vi.mock('../../actions', () => ({
  startSnag: (...args: unknown[]) => startSnagMock(...args),
  resolveSnag: (...args: unknown[]) => resolveSnagMock(...args),
  verifySnag: (...args: unknown[]) => verifySnagMock(...args),
  rejectSnag: (...args: unknown[]) => rejectSnagMock(...args),
}));

import { SnagActions } from '../SnagActions';

beforeEach(() => {
  startSnagMock.mockReset();
  resolveSnagMock.mockReset();
  verifySnagMock.mockReset();
  rejectSnagMock.mockReset();
});

describe('SnagActions — terminal states', () => {
  it('shows no action, just a dash, for a VERIFIED snag', () => {
    render(<SnagActions id="snag-1" status="VERIFIED" handoverRecordId="hr-1" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no action, just a dash, for a REJECTED snag', () => {
    render(<SnagActions id="snag-1" status="REJECTED" handoverRecordId="hr-1" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('SnagActions — OPEN', () => {
  it('shows Start, Resolve (with notes field), and Reject (with reason field)', () => {
    render(<SnagActions id="snag-1" status="OPEN" handoverRecordId="hr-1" />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
    expect(screen.getByLabelText('Resolution notes (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByLabelText('Rejection reason')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument();
  });

  it('calls startSnag with (id, handoverRecordId) when Start is clicked', async () => {
    startSnagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SnagActions id="snag-1" status="OPEN" handoverRecordId="hr-1" />);

    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(startSnagMock).toHaveBeenCalledWith('snag-1', 'hr-1');
  });

  it('calls resolveSnag with trimmed notes, or undefined when left blank', async () => {
    resolveSnagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SnagActions id="snag-1" status="OPEN" handoverRecordId="hr-1" />);

    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(resolveSnagMock).toHaveBeenCalledWith('snag-1', 'hr-1', undefined);

    resolveSnagMock.mockClear();
    await user.type(screen.getByLabelText('Resolution notes (optional)'), '  Fixed the leak  ');
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(resolveSnagMock).toHaveBeenCalledWith('snag-1', 'hr-1', 'Fixed the leak');
  });

  it('blocks Reject with an inline error when the reason is blank, without calling rejectSnag', async () => {
    const user = userEvent.setup();
    render(<SnagActions id="snag-1" status="OPEN" handoverRecordId="hr-1" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('A rejection reason is required.')).toBeInTheDocument();
    expect(rejectSnagMock).not.toHaveBeenCalled();
  });

  it('calls rejectSnag with the trimmed reason once provided', async () => {
    rejectSnagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SnagActions id="snag-1" status="OPEN" handoverRecordId="hr-1" />);

    await user.type(screen.getByLabelText('Rejection reason'), '  Not actually a defect  ');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(rejectSnagMock).toHaveBeenCalledWith('snag-1', 'hr-1', 'Not actually a defect');
  });
});

describe('SnagActions — IN_PROGRESS', () => {
  it('shows Resolve and Reject, but not Start or Verify', () => {
    render(<SnagActions id="snag-1" status="IN_PROGRESS" handoverRecordId="hr-1" />);

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument();
  });
});

describe('SnagActions — RESOLVED', () => {
  it('shows Verify and Reject, but not Start or Resolve', () => {
    render(<SnagActions id="snag-1" status="RESOLVED" handoverRecordId="hr-1" />);

    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument();
  });

  it('calls verifySnag with (id, handoverRecordId) when Verify is clicked', async () => {
    verifySnagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SnagActions id="snag-1" status="RESOLVED" handoverRecordId="hr-1" />);

    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(verifySnagMock).toHaveBeenCalledWith('snag-1', 'hr-1');
  });
});

describe('SnagActions — ids and errors', () => {
  it('gives the Resolution notes and Rejection reason fields row-unique explicit ids', () => {
    render(<SnagActions id="snag-42" status="OPEN" handoverRecordId="hr-1" />);

    expect(screen.getByLabelText('Resolution notes (optional)')).toHaveAttribute('id', 'resolution-notes-snag-42');
    expect(screen.getByLabelText('Rejection reason')).toHaveAttribute('id', 'rejection-reason-snag-42');
  });

  it('shows the action-returned error message when an action fails', async () => {
    startSnagMock.mockResolvedValue({ ok: false, error: 'This snag has already been started' });
    const user = userEvent.setup();
    render(<SnagActions id="snag-1" status="OPEN" handoverRecordId="hr-1" />);

    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('This snag has already been started')).toBeInTheDocument();
  });

  it('falls back to a generic error message when an action fails without one', async () => {
    startSnagMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<SnagActions id="snag-1" status="OPEN" handoverRecordId="hr-1" />);

    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('Failed to update snag.')).toBeInTheDocument();
  });

  it('disables every action button while one is pending, showing the pending label on the active one', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    startSnagMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<SnagActions id="snag-1" status="OPEN" handoverRecordId="hr-1" />);

    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Start' })).not.toBeDisabled();
  });
});
