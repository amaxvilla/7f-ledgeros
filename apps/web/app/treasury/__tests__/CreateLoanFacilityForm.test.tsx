import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createLoanFacilityMock = vi.fn();
vi.mock('../actions', () => ({
  createLoanFacility: (...args: unknown[]) => createLoanFacilityMock(...args),
}));

import { CreateLoanFacilityForm } from '../CreateLoanFacilityForm';

beforeEach(() => {
  createLoanFacilityMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Lender'), 'Zenith Bank');
  await user.type(screen.getByLabelText('Facility amount'), '50000000');
  await user.type(screen.getByLabelText('Interest rate %'), '18.5');
  await user.type(screen.getByLabelText('Start date'), '2026-01-01');
  await user.type(screen.getByLabelText('Maturity date'), '2028-01-01');
}

describe('CreateLoanFacilityForm', () => {
  it('renders every field with its label', () => {
    render(<CreateLoanFacilityForm entityId="ent-1" />);

    expect(screen.getByLabelText('Lender')).toBeInTheDocument();
    expect(screen.getByLabelText('Facility amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Interest rate %')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('Maturity date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add loan facility' })).toBeInTheDocument();
  });

  it('marks every field required except currency', () => {
    render(<CreateLoanFacilityForm entityId="ent-1" />);

    expect(screen.getByLabelText('Lender')).toBeRequired();
    expect(screen.getByLabelText('Facility amount')).toBeRequired();
    expect(screen.getByLabelText('Currency (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Interest rate %')).toBeRequired();
    expect(screen.getByLabelText('Start date')).toBeRequired();
    expect(screen.getByLabelText('Maturity date')).toBeRequired();
  });

  it('submits with entityId, converts numeric fields, and omits currency (undefined) when left blank', async () => {
    createLoanFacilityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLoanFacilityForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add loan facility' }));

    expect(createLoanFacilityMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      lenderName: 'Zenith Bank',
      facilityAmount: 50000000,
      currency: undefined,
      interestRatePercent: 18.5,
      startDate: '2026-01-01',
      maturityDate: '2028-01-01',
    });
  });

  it('includes currency when filled in', async () => {
    createLoanFacilityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLoanFacilityForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Currency (optional)'), 'USD');
    await user.click(screen.getByRole('button', { name: 'Add loan facility' }));

    expect(createLoanFacilityMock).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
  });

  it('shows the action-returned error message on failure', async () => {
    createLoanFacilityMock.mockResolvedValue({ ok: false, error: 'Maturity date must be after the start date' });
    const user = userEvent.setup();
    render(<CreateLoanFacilityForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add loan facility' }));

    expect(await screen.findByText('Maturity date must be after the start date')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createLoanFacilityMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateLoanFacilityForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add loan facility' }));

    expect(await screen.findByText('Failed to create loan facility.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createLoanFacilityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLoanFacilityForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add loan facility' }));

    expect(await screen.findByLabelText('Lender')).toHaveValue('');
    expect(screen.getByLabelText('Facility amount')).toHaveValue(null);
    expect(screen.getByLabelText('Start date')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createLoanFacilityMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateLoanFacilityForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add loan facility' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add loan facility' })).not.toBeDisabled();
  });
});
