import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const reserveUnitMock = vi.fn();
vi.mock('../actions', () => ({
  reserveUnit: (...args: unknown[]) => reserveUnitMock(...args),
}));

import { ReserveUnitForm } from '../ReserveUnitForm';

const UNIT_OPTIONS = [
  { value: 'unit-1', label: 'A-1-01 — 1st Floor, Block A' },
  { value: 'unit-2', label: 'A-1-02 — 1st Floor, Block A' },
];

const CUSTOMER_OPTIONS = [
  { value: 'cust-1', label: 'CUST-001 — Jane Doe' },
  { value: 'cust-2', label: 'CUST-002 — John Smith' },
];

beforeEach(() => {
  reserveUnitMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Unit'), 'unit-1');
  await user.selectOptions(screen.getByLabelText('Customer'), 'cust-1');
}

describe('ReserveUnitForm', () => {
  it('renders Unit, Customer, and both optional fields, plus the submit button', () => {
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    expect(screen.getByLabelText('Unit')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer')).toBeInTheDocument();
    expect(screen.getByLabelText('Expires in (hours, optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Reservation fee (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserve unit' })).toBeInTheDocument();
  });

  it('lists every passed-in unit and customer option', () => {
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'A-1-01 — 1st Floor, Block A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'A-1-02 — 1st Floor, Block A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CUST-001 — Jane Doe' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CUST-002 — John Smith' })).toBeInTheDocument();
  });

  it('calls reserveUnit with entityId/projectId and no optional fields when left blank', async () => {
    reserveUnitMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Reserve unit' }));

    expect(reserveUnitMock).toHaveBeenCalledWith({
      unitId: 'unit-1',
      customerId: 'cust-1',
      entityId: 'ent-1',
      projectId: 'proj-1',
      expiresInHours: undefined,
      reservationFee: undefined,
    });
  });

  it('passes expiresInHours and reservationFee as numbers when filled in', async () => {
    reserveUnitMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Expires in (hours, optional)'), '48');
    await user.type(screen.getByLabelText('Reservation fee (optional)'), '50000');
    await user.click(screen.getByRole('button', { name: 'Reserve unit' }));

    expect(reserveUnitMock).toHaveBeenCalledWith({
      unitId: 'unit-1',
      customerId: 'cust-1',
      entityId: 'ent-1',
      projectId: 'proj-1',
      expiresInHours: 48,
      reservationFee: 50000,
    });
  });

  it('shows the action-returned error message on failure', async () => {
    reserveUnitMock.mockResolvedValue({ ok: false, error: 'Unit A-1-01 is not AVAILABLE (currently RESERVED)' });
    const user = userEvent.setup();
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Reserve unit' }));

    expect(await screen.findByText('Unit A-1-01 is not AVAILABLE (currently RESERVED)')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    reserveUnitMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Reserve unit' }));

    expect(await screen.findByText('Failed to reserve unit.')).toBeInTheDocument();
  });

  it('does not reset the form fields after a failed submit', async () => {
    reserveUnitMock.mockResolvedValue({ ok: false, error: 'Unit is not AVAILABLE' });
    const user = userEvent.setup();
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Reserve unit' }));
    await screen.findByText('Unit is not AVAILABLE');

    expect(screen.getByLabelText('Unit')).toHaveValue('unit-1');
    expect(screen.getByLabelText('Customer')).toHaveValue('cust-1');
  });

  it('resets Unit, Customer, and both optional fields after a successful submit', async () => {
    reserveUnitMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Expires in (hours, optional)'), '48');
    await user.type(screen.getByLabelText('Reservation fee (optional)'), '50000');
    await user.click(screen.getByRole('button', { name: 'Reserve unit' }));

    expect(await screen.findByText('Unit reserved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit')).toHaveValue('');
    expect(screen.getByLabelText('Customer')).toHaveValue('');
    expect(screen.getByLabelText('Expires in (hours, optional)')).toHaveValue(null);
    expect(screen.getByLabelText('Reservation fee (optional)')).toHaveValue(null);
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    reserveUnitMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ReserveUnitForm entityId="ent-1" projectId="proj-1" unitOptions={UNIT_OPTIONS} customerOptions={CUSTOMER_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Reserve unit' }));
    expect(screen.getByRole('button', { name: 'Reserving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reserve unit' })).not.toBeDisabled();
  });
});
