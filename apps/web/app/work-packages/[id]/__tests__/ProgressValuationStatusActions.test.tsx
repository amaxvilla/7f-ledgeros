import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const advanceProgressValuationMock = vi.fn();
vi.mock('../actions', () => ({
  advanceProgressValuation: (...args: unknown[]) => advanceProgressValuationMock(...args),
}));

import { ProgressValuationStatusActions } from '../ProgressValuationStatusActions';

beforeEach(() => {
  advanceProgressValuationMock.mockReset();
});

describe('ProgressValuationStatusActions', () => {
  it('shows "Advance to Reviewed" and "Reject" for a DRAFT valuation', () => {
    render(<ProgressValuationStatusActions id="pv-1" status="DRAFT" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows "Advance to Approved" for a REVIEWED valuation', () => {
    render(<ProgressValuationStatusActions id="pv-1" status="REVIEWED" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Approved' })).toBeInTheDocument();
  });

  it('shows "Advance to Certified" for an APPROVED valuation', () => {
    render(<ProgressValuationStatusActions id="pv-1" status="APPROVED" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Certified' })).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for an already-CERTIFIED valuation', () => {
    render(<ProgressValuationStatusActions id="pv-1" status="CERTIFIED" workPackageId="wp-1" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for a REJECTED valuation', () => {
    render(<ProgressValuationStatusActions id="pv-1" status="REJECTED" workPackageId="wp-1" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls advanceProgressValuation with (id, target, workPackageId) when "Advance" is clicked', async () => {
    advanceProgressValuationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProgressValuationStatusActions id="pv-42" status="DRAFT" workPackageId="wp-7" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(advanceProgressValuationMock).toHaveBeenCalledWith('pv-42', 'REVIEWED', 'wp-7');
  });

  it('calls advanceProgressValuation with REJECTED when "Reject" is clicked', async () => {
    advanceProgressValuationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProgressValuationStatusActions id="pv-42" status="DRAFT" workPackageId="wp-7" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(advanceProgressValuationMock).toHaveBeenCalledWith('pv-42', 'REJECTED', 'wp-7');
  });

  it('shows the action-returned error message on failure', async () => {
    advanceProgressValuationMock.mockResolvedValue({ ok: false, error: 'Cannot move valuation from DRAFT to CERTIFIED' });
    const user = userEvent.setup();
    render(<ProgressValuationStatusActions id="pv-42" status="DRAFT" workPackageId="wp-7" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Cannot move valuation from DRAFT to CERTIFIED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    advanceProgressValuationMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ProgressValuationStatusActions id="pv-42" status="DRAFT" workPackageId="wp-7" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Failed to update progress valuation status.')).toBeInTheDocument();
  });

  it('disables both buttons and shows the pending label while advancing', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceProgressValuationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ProgressValuationStatusActions id="pv-42" status="DRAFT" workPackageId="wp-7" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));
    expect(screen.getByRole('button', { name: 'Advancing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Advance to Reviewed' })).not.toBeDisabled();
  });

  it('disables both buttons and shows the pending label while rejecting', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceProgressValuationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ProgressValuationStatusActions id="pv-42" status="DRAFT" workPackageId="wp-7" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('button', { name: 'Rejecting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reject' })).not.toBeDisabled();
  });
});
