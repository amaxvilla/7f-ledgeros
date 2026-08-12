import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const cancelReservationMock = vi.fn();
const cancelAllocationMock = vi.fn();
vi.mock('../actions', () => ({
  cancelReservation: (...args: unknown[]) => cancelReservationMock(...args),
  cancelAllocation: (...args: unknown[]) => cancelAllocationMock(...args),
}));

import { CancelCurrentForm } from '../CancelCurrentForm';

beforeEach(() => {
  cancelReservationMock.mockReset();
  cancelAllocationMock.mockReset();
});

describe('CancelCurrentForm', () => {
  it('renders the Reason field and a kind-labeled submit button for a reservation', () => {
    render(<CancelCurrentForm unitId="unit-1" kind="reservation" targetId="res-1" />);

    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel reservation' })).toBeInTheDocument();
  });

  it('renders a kind-labeled submit button for an allocation', () => {
    render(<CancelCurrentForm unitId="unit-1" kind="allocation" targetId="alloc-1" />);

    expect(screen.getByRole('button', { name: 'Cancel allocation' })).toBeInTheDocument();
  });

  it('marks Reason as required', () => {
    render(<CancelCurrentForm unitId="unit-1" kind="reservation" targetId="res-1" />);

    expect(screen.getByLabelText('Reason')).toBeRequired();
  });

  it('calls cancelReservation, not cancelAllocation, when kind is "reservation"', async () => {
    cancelReservationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CancelCurrentForm unitId="unit-1" kind="reservation" targetId="res-1" />);

    await user.type(screen.getByLabelText('Reason'), 'Customer withdrew');
    await user.click(screen.getByRole('button', { name: 'Cancel reservation' }));

    expect(cancelReservationMock).toHaveBeenCalledWith('unit-1', 'res-1', 'Customer withdrew');
    expect(cancelAllocationMock).not.toHaveBeenCalled();
  });

  it('calls cancelAllocation, not cancelReservation, when kind is "allocation"', async () => {
    cancelAllocationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CancelCurrentForm unitId="unit-1" kind="allocation" targetId="alloc-1" />);

    await user.type(screen.getByLabelText('Reason'), 'Financing fell through');
    await user.click(screen.getByRole('button', { name: 'Cancel allocation' }));

    expect(cancelAllocationMock).toHaveBeenCalledWith('unit-1', 'alloc-1', 'Financing fell through');
    expect(cancelReservationMock).not.toHaveBeenCalled();
  });

  it('shows the action-returned error message on failure', async () => {
    cancelReservationMock.mockResolvedValue({ ok: false, error: 'Cannot cancel a reservation with status CONVERTED' });
    const user = userEvent.setup();
    render(<CancelCurrentForm unitId="unit-1" kind="reservation" targetId="res-1" />);

    await user.type(screen.getByLabelText('Reason'), 'Attempted cancel');
    await user.click(screen.getByRole('button', { name: 'Cancel reservation' }));

    expect(await screen.findByText('Cannot cancel a reservation with status CONVERTED')).toBeInTheDocument();
  });

  it('falls back to a kind-specific generic error message when the action fails without one', async () => {
    cancelAllocationMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CancelCurrentForm unitId="unit-1" kind="allocation" targetId="alloc-1" />);

    await user.type(screen.getByLabelText('Reason'), 'Attempted cancel');
    await user.click(screen.getByRole('button', { name: 'Cancel allocation' }));

    expect(await screen.findByText('Failed to cancel allocation.')).toBeInTheDocument();
  });

  it('resets the Reason field after a successful submit', async () => {
    cancelReservationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CancelCurrentForm unitId="unit-1" kind="reservation" targetId="res-1" />);

    await user.type(screen.getByLabelText('Reason'), 'Customer withdrew');
    await user.click(screen.getByRole('button', { name: 'Cancel reservation' }));

    expect(await screen.findByLabelText('Reason')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    cancelReservationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CancelCurrentForm unitId="unit-1" kind="reservation" targetId="res-1" />);

    await user.type(screen.getByLabelText('Reason'), 'Customer withdrew');
    await user.click(screen.getByRole('button', { name: 'Cancel reservation' }));

    const pendingButton = screen.getByRole('button', { name: 'Cancelling…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Cancel reservation' })).not.toBeDisabled();
  });
});
