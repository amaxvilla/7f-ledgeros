import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const recordAcquisitionMock = vi.fn();
vi.mock('../actions', () => ({
  recordAcquisition: (...args: unknown[]) => recordAcquisitionMock(...args),
}));

import { RecordAcquisitionForm } from '../RecordAcquisitionForm';

const PARCEL_OPTIONS = [{ value: 'parcel-1', label: 'LP-001 — Riverside Parcel A' }];

beforeEach(() => {
  recordAcquisitionMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Parcel'), 'parcel-1');
  await user.type(screen.getByLabelText('Vendor name'), 'Acme Land Holdings');
  await user.type(screen.getByLabelText('Agreed price'), '5000000');
}

describe('RecordAcquisitionForm', () => {
  it('renders every field', () => {
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    expect(screen.getByLabelText('Parcel')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor name')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor contact (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Agreed price')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment terms (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Due diligence notes (optional)')).toBeInTheDocument();
  });

  it('marks only Parcel/Vendor name/Agreed price as required', () => {
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    expect(screen.getByLabelText('Parcel')).toBeRequired();
    expect(screen.getByLabelText('Vendor name')).toBeRequired();
    expect(screen.getByLabelText('Agreed price')).toBeRequired();
    expect(screen.getByLabelText('Vendor contact (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Currency (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Payment terms (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Due diligence notes (optional)')).not.toBeRequired();
  });

  it('submits the entered values, with optional fields omitted as undefined when blank', async () => {
    recordAcquisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Record acquisition' }));

    expect(recordAcquisitionMock).toHaveBeenCalledWith({
      parcelId: 'parcel-1',
      vendorName: 'Acme Land Holdings',
      vendorContact: undefined,
      agreedPrice: 5000000,
      currency: undefined,
      paymentTerms: undefined,
      dueDiligenceNotes: undefined,
    });
  });

  it('includes optional fields, including due diligence notes, when filled in', async () => {
    recordAcquisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Vendor contact (optional)'), '+2348012345678');
    await user.type(screen.getByLabelText('Currency (optional)'), 'NGN');
    await user.type(screen.getByLabelText('Payment terms (optional)'), '50% upfront, 50% on title');
    await user.type(screen.getByLabelText('Due diligence notes (optional)'), 'Title search clean, no encumbrances found');
    await user.click(screen.getByRole('button', { name: 'Record acquisition' }));

    expect(recordAcquisitionMock).toHaveBeenCalledWith({
      parcelId: 'parcel-1',
      vendorName: 'Acme Land Holdings',
      vendorContact: '+2348012345678',
      agreedPrice: 5000000,
      currency: 'NGN',
      paymentTerms: '50% upfront, 50% on title',
      dueDiligenceNotes: 'Title search clean, no encumbrances found',
    });
  });

  it('shows a success message after a successful submission', async () => {
    recordAcquisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Record acquisition' }));

    expect(await screen.findByText('Acquisition recorded against the selected parcel.')).toBeInTheDocument();
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    recordAcquisitionMock.mockResolvedValue({ ok: false, error: 'Parcel not found.' });
    const user = userEvent.setup();
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Record acquisition' }));

    expect(await screen.findByText('Parcel not found.')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor name')).toHaveValue('Acme Land Holdings');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    recordAcquisitionMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Record acquisition' }));

    expect(await screen.findByText('Failed to record acquisition.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    recordAcquisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Currency (optional)'), 'NGN');
    await user.click(screen.getByRole('button', { name: 'Record acquisition' }));

    expect(await screen.findByLabelText('Vendor name')).toHaveValue('');
    expect(screen.getByLabelText('Agreed price')).toHaveValue(null);
    expect(screen.getByLabelText('Currency (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    recordAcquisitionMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RecordAcquisitionForm parcelOptions={PARCEL_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Record acquisition' }));

    expect(screen.getByRole('button', { name: 'Recording…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Record acquisition' })).not.toBeDisabled();
  });
});
