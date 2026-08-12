import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const advanceVariationOrderMock = vi.fn();
vi.mock('../actions', () => ({
  advanceVariationOrder: (...args: unknown[]) => advanceVariationOrderMock(...args),
}));

import { VariationOrderStatusActions } from '../VariationOrderStatusActions';

beforeEach(() => {
  advanceVariationOrderMock.mockReset();
});

describe('VariationOrderStatusActions', () => {
  it('shows "Advance to Reviewed" and "Reject" for a DRAFT variation order', () => {
    render(<VariationOrderStatusActions id="vo-1" status="DRAFT" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows "Advance to Approved" for a REVIEWED variation order', () => {
    render(<VariationOrderStatusActions id="vo-1" status="REVIEWED" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Approved' })).toBeInTheDocument();
  });

  it('shows "Advance to Certified" for an APPROVED variation order', () => {
    render(<VariationOrderStatusActions id="vo-1" status="APPROVED" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Certified' })).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for an already-CERTIFIED variation order', () => {
    render(<VariationOrderStatusActions id="vo-1" status="CERTIFIED" workPackageId="wp-1" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for a REJECTED variation order', () => {
    render(<VariationOrderStatusActions id="vo-1" status="REJECTED" workPackageId="wp-1" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls advanceVariationOrder with (id, target, workPackageId) when Advance is clicked', async () => {
    advanceVariationOrderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<VariationOrderStatusActions id="vo-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(advanceVariationOrderMock).toHaveBeenCalledWith('vo-1', 'REVIEWED', 'wp-1');
  });

  it('calls advanceVariationOrder with REJECTED when Reject is clicked', async () => {
    advanceVariationOrderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<VariationOrderStatusActions id="vo-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(advanceVariationOrderMock).toHaveBeenCalledWith('vo-1', 'REJECTED', 'wp-1');
  });

  it('shows the action-returned error message on Advance failure', async () => {
    advanceVariationOrderMock.mockResolvedValue({ ok: false, error: 'Cannot advance from CERTIFIED to REVIEWED' });
    const user = userEvent.setup();
    render(<VariationOrderStatusActions id="vo-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Cannot advance from CERTIFIED to REVIEWED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    advanceVariationOrderMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<VariationOrderStatusActions id="vo-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Failed to update variation order status.')).toBeInTheDocument();
  });

  it('disables both buttons and shows the pending label on the Advance button while advancing', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceVariationOrderMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<VariationOrderStatusActions id="vo-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(screen.getByRole('button', { name: 'Advancing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Advance to Reviewed' })).not.toBeDisabled();
  });

  it('disables both buttons and shows the pending label on the Reject button while rejecting', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceVariationOrderMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<VariationOrderStatusActions id="vo-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(screen.getByRole('button', { name: 'Rejecting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reject' })).not.toBeDisabled();
  });
});
