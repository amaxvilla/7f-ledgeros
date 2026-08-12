import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const convertReservationMock = vi.fn();
vi.mock('../actions', () => ({
  convertReservation: (...args: unknown[]) => convertReservationMock(...args),
}));

import { ConvertReservationForm } from '../ConvertReservationForm';

const ACCOUNT_OPTIONS = [
  { value: 'acct-1', label: '4000 — Unit Sales Revenue' },
  { value: 'acct-2', label: '1200 — Accounts Receivable Control' },
];

beforeEach(() => {
  convertReservationMock.mockReset();
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Sale price'), '45000000');
  await user.type(screen.getByLabelText('Allocation date'), '2026-08-15');
  await user.type(screen.getByLabelText('Invoice number'), 'INV-2026-0042');
  await user.selectOptions(screen.getByLabelText('Revenue account'), 'acct-1');
  await user.selectOptions(screen.getByLabelText('AR control account'), 'acct-2');
}

describe('ConvertReservationForm', () => {
  it('renders every field with its label', () => {
    render(<ConvertReservationForm unitId="unit-1" reservationId="res-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Sale price')).toBeInTheDocument();
    expect(screen.getByLabelText('Allocation date')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice number')).toBeInTheDocument();
    expect(screen.getByLabelText('Revenue account')).toBeInTheDocument();
    expect(screen.getByLabelText('AR control account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convert to sale' })).toBeInTheDocument();
  });

  it('populates both account Selects from the accountOptions prop', () => {
    render(<ConvertReservationForm unitId="unit-1" reservationId="res-1" accountOptions={ACCOUNT_OPTIONS} />);

    const options = screen.getAllByRole('option', { name: '4000 — Unit Sales Revenue' });
    expect(options).toHaveLength(2);
  });

  it('marks every field as required', () => {
    render(<ConvertReservationForm unitId="unit-1" reservationId="res-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Sale price')).toBeRequired();
    expect(screen.getByLabelText('Allocation date')).toBeRequired();
    expect(screen.getByLabelText('Invoice number')).toBeRequired();
    expect(screen.getByLabelText('Revenue account')).toBeRequired();
    expect(screen.getByLabelText('AR control account')).toBeRequired();
  });

  it('submits a payload with a numeric salePrice and the unit/reservation ids', async () => {
    convertReservationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ConvertReservationForm unitId="unit-1" reservationId="res-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Convert to sale' }));

    expect(convertReservationMock).toHaveBeenCalledWith('unit-1', 'res-1', {
      salePrice: 45000000,
      allocationDate: '2026-08-15',
      invoiceNumber: 'INV-2026-0042',
      revenueAccountId: 'acct-1',
      arControlAccountId: 'acct-2',
    });
  });

  it('shows the action-returned error message on failure', async () => {
    convertReservationMock.mockResolvedValue({ ok: false, error: 'This reservation has expired — expire it and create a new reservation instead' });
    const user = userEvent.setup();
    render(<ConvertReservationForm unitId="unit-1" reservationId="res-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Convert to sale' }));

    expect(
      await screen.findByText('This reservation has expired — expire it and create a new reservation instead'),
    ).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    convertReservationMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ConvertReservationForm unitId="unit-1" reservationId="res-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Convert to sale' }));

    expect(await screen.findByText('Failed to convert reservation to sale.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    convertReservationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ConvertReservationForm unitId="unit-1" reservationId="res-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Convert to sale' }));

    expect(await screen.findByLabelText('Sale price')).toHaveValue(null);
    expect(screen.getByLabelText('Allocation date')).toHaveValue('');
    expect(screen.getByLabelText('Invoice number')).toHaveValue('');
    expect(screen.getByLabelText('Revenue account')).toHaveValue('');
    expect(screen.getByLabelText('AR control account')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    convertReservationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ConvertReservationForm unitId="unit-1" reservationId="res-1" accountOptions={ACCOUNT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Convert to sale' }));

    const pendingButton = screen.getByRole('button', { name: 'Converting…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Convert to sale' })).not.toBeDisabled();
  });
});
