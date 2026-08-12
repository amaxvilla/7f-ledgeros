import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const addTitleDeedMock = vi.fn();
vi.mock('../actions', () => ({
  addTitleDeed: (...args: unknown[]) => addTitleDeedMock(...args),
}));

import { AddTitleDeedForm } from '../AddTitleDeedForm';

beforeEach(() => {
  addTitleDeedMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Title type'), 'CERTIFICATE_OF_OCCUPANCY');
}

describe('AddTitleDeedForm', () => {
  it('renders every field', () => {
    render(<AddTitleDeedForm parcelId="parcel-1" />);

    expect(screen.getByLabelText('Title type')).toBeInTheDocument();
    expect(screen.getByLabelText('Title number (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Issuing authority (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Application date (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Document reference (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
  });

  it('marks only Title type as required', () => {
    render(<AddTitleDeedForm parcelId="parcel-1" />);

    expect(screen.getByLabelText('Title type')).toBeRequired();
    expect(screen.getByLabelText('Title number (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Issuing authority (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Application date (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Document reference (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Notes (optional)')).not.toBeRequired();
  });

  it('submits parcelId and the selected type, with optional fields omitted as undefined when blank', async () => {
    addTitleDeedMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AddTitleDeedForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add title deed' }));

    expect(addTitleDeedMock).toHaveBeenCalledWith({
      parcelId: 'parcel-1',
      titleType: 'CERTIFICATE_OF_OCCUPANCY',
      titleNumber: undefined,
      issuingAuthority: undefined,
      applicationDate: undefined,
      documentRef: undefined,
      notes: undefined,
    });
  });

  it('includes optional fields when filled in', async () => {
    addTitleDeedMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AddTitleDeedForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Title number (optional)'), 'C-O-12345');
    await user.type(screen.getByLabelText('Issuing authority (optional)'), 'Lagos State Land Bureau');
    await user.type(screen.getByLabelText('Application date (optional)'), '2026-07-01');
    await user.type(screen.getByLabelText('Document reference (optional)'), 'DOC-001');
    await user.type(screen.getByLabelText('Notes (optional)'), 'Awaiting Governor consent');
    await user.click(screen.getByRole('button', { name: 'Add title deed' }));

    expect(addTitleDeedMock).toHaveBeenCalledWith({
      parcelId: 'parcel-1',
      titleType: 'CERTIFICATE_OF_OCCUPANCY',
      titleNumber: 'C-O-12345',
      issuingAuthority: 'Lagos State Land Bureau',
      applicationDate: '2026-07-01',
      documentRef: 'DOC-001',
      notes: 'Awaiting Governor consent',
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    addTitleDeedMock.mockResolvedValue({ ok: false, error: 'Land parcel not found' });
    const user = userEvent.setup();
    render(<AddTitleDeedForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add title deed' }));

    expect(await screen.findByText('Land parcel not found')).toBeInTheDocument();
    expect(screen.getByLabelText('Title type')).toHaveValue('CERTIFICATE_OF_OCCUPANCY');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    addTitleDeedMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<AddTitleDeedForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add title deed' }));

    expect(await screen.findByText('Failed to add title deed.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    addTitleDeedMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AddTitleDeedForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Title number (optional)'), 'C-O-12345');
    await user.click(screen.getByRole('button', { name: 'Add title deed' }));

    expect(await screen.findByLabelText('Title type')).toHaveValue('');
    expect(screen.getByLabelText('Title number (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    addTitleDeedMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<AddTitleDeedForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add title deed' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add title deed' })).not.toBeDisabled();
  });
});
