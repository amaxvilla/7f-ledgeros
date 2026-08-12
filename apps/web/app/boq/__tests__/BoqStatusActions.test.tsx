import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const advanceBoqMock = vi.fn();
vi.mock('../actions', () => ({
  advanceBoq: (...args: unknown[]) => advanceBoqMock(...args),
}));

import { BoqStatusActions } from '../BoqStatusActions';

beforeEach(() => {
  advanceBoqMock.mockReset();
});

describe('BoqStatusActions', () => {
  it('shows "Advance to Reviewed" and "Reject" for a DRAFT boq', () => {
    render(<BoqStatusActions id="boq-1" status="DRAFT" />);

    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows "Advance to Approved" for a REVIEWED boq', () => {
    render(<BoqStatusActions id="boq-1" status="REVIEWED" />);

    expect(screen.getByRole('button', { name: 'Advance to Approved' })).toBeInTheDocument();
  });

  it('shows "Advance to Certified" for an APPROVED boq', () => {
    render(<BoqStatusActions id="boq-1" status="APPROVED" />);

    expect(screen.getByRole('button', { name: 'Advance to Certified' })).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for an already-CERTIFIED boq', () => {
    render(<BoqStatusActions id="boq-1" status="CERTIFIED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for a REJECTED boq', () => {
    render(<BoqStatusActions id="boq-1" status="REJECTED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls advanceBoq with the next status when "Advance" is clicked', async () => {
    advanceBoqMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BoqStatusActions id="boq-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(advanceBoqMock).toHaveBeenCalledWith('boq-42', 'REVIEWED');
  });

  it('calls advanceBoq with REJECTED when "Reject" is clicked', async () => {
    advanceBoqMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BoqStatusActions id="boq-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(advanceBoqMock).toHaveBeenCalledWith('boq-42', 'REJECTED');
  });

  it('shows the action-returned error message on failure', async () => {
    advanceBoqMock.mockResolvedValue({ ok: false, error: 'Cannot move boq from DRAFT to CERTIFIED' });
    const user = userEvent.setup();
    render(<BoqStatusActions id="boq-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Cannot move boq from DRAFT to CERTIFIED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    advanceBoqMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<BoqStatusActions id="boq-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Failed to update BOQ status.')).toBeInTheDocument();
  });

  it('disables both buttons and shows the pending label while advancing', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceBoqMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<BoqStatusActions id="boq-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));
    expect(screen.getByRole('button', { name: 'Advancing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Advance to Reviewed' })).not.toBeDisabled();
  });

  it('disables both buttons and shows the pending label while rejecting', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceBoqMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<BoqStatusActions id="boq-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('button', { name: 'Rejecting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reject' })).not.toBeDisabled();
  });
});
