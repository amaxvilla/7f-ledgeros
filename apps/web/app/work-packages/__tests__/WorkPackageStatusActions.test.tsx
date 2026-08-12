import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const advanceWorkPackageMock = vi.fn();
vi.mock('../actions', () => ({
  advanceWorkPackage: (...args: unknown[]) => advanceWorkPackageMock(...args),
}));

import { WorkPackageStatusActions } from '../WorkPackageStatusActions';

beforeEach(() => {
  advanceWorkPackageMock.mockReset();
});

describe('WorkPackageStatusActions', () => {
  it('shows "Advance to Reviewed" and "Reject" for a DRAFT work package', () => {
    render(<WorkPackageStatusActions id="wp-1" status="DRAFT" />);

    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows "Advance to Approved" for a REVIEWED work package', () => {
    render(<WorkPackageStatusActions id="wp-1" status="REVIEWED" />);

    expect(screen.getByRole('button', { name: 'Advance to Approved' })).toBeInTheDocument();
  });

  it('shows "Advance to Certified" for an APPROVED work package', () => {
    render(<WorkPackageStatusActions id="wp-1" status="APPROVED" />);

    expect(screen.getByRole('button', { name: 'Advance to Certified' })).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for an already-CERTIFIED work package', () => {
    render(<WorkPackageStatusActions id="wp-1" status="CERTIFIED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for a REJECTED work package', () => {
    render(<WorkPackageStatusActions id="wp-1" status="REJECTED" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls advanceWorkPackage with the next status when "Advance" is clicked', async () => {
    advanceWorkPackageMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<WorkPackageStatusActions id="wp-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(advanceWorkPackageMock).toHaveBeenCalledWith('wp-42', 'REVIEWED');
  });

  it('calls advanceWorkPackage with REJECTED when "Reject" is clicked', async () => {
    advanceWorkPackageMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<WorkPackageStatusActions id="wp-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(advanceWorkPackageMock).toHaveBeenCalledWith('wp-42', 'REJECTED');
  });

  it('shows the action-returned error message on failure', async () => {
    advanceWorkPackageMock.mockResolvedValue({ ok: false, error: 'Cannot move work package from DRAFT to CERTIFIED' });
    const user = userEvent.setup();
    render(<WorkPackageStatusActions id="wp-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Cannot move work package from DRAFT to CERTIFIED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    advanceWorkPackageMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<WorkPackageStatusActions id="wp-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Failed to update work package status.')).toBeInTheDocument();
  });

  it('disables both buttons and shows the pending label while advancing', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceWorkPackageMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<WorkPackageStatusActions id="wp-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));
    expect(screen.getByRole('button', { name: 'Advancing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Advance to Reviewed' })).not.toBeDisabled();
  });

  it('disables both buttons and shows the pending label while rejecting', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceWorkPackageMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<WorkPackageStatusActions id="wp-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('button', { name: 'Rejecting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reject' })).not.toBeDisabled();
  });
});
