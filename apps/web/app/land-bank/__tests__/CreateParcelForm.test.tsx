import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createParcelMock = vi.fn();
vi.mock('../actions', () => ({
  createParcel: (...args: unknown[]) => createParcelMock(...args),
}));

import { CreateParcelForm } from '../CreateParcelForm';

beforeEach(() => {
  createParcelMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Code'), 'LP-001');
  await user.type(screen.getByLabelText('Name'), 'Riverside Parcel A');
  await user.type(screen.getByLabelText('Area (sqm)'), '50000');
}

describe('CreateParcelForm', () => {
  it('renders every field', () => {
    render(<CreateParcelForm entityId="ent-1" />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Location (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('State/province (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Local government area (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Area (sqm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Acquisition cost budget (optional)')).toBeInTheDocument();
  });

  it('marks only Code/Name/Area (sqm) as required', () => {
    render(<CreateParcelForm entityId="ent-1" />);

    expect(screen.getByLabelText('Code')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Area (sqm)')).toBeRequired();
    expect(screen.getByLabelText('Location (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('State/province (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Local government area (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Acquisition cost budget (optional)')).not.toBeRequired();
  });

  it('submits entityId and the entered values, with optional fields omitted as undefined when blank', async () => {
    createParcelMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateParcelForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add parcel' }));

    expect(createParcelMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      code: 'LP-001',
      name: 'Riverside Parcel A',
      location: undefined,
      stateProvince: undefined,
      localGovernmentArea: undefined,
      areaSqm: 50000,
      acquisitionCostBudget: undefined,
    });
  });

  it('includes optional fields, with numeric conversion for acquisitionCostBudget, when filled in', async () => {
    createParcelMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateParcelForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Location (optional)'), 'Lekki Phase 2');
    await user.type(screen.getByLabelText('State/province (optional)'), 'Lagos');
    await user.type(screen.getByLabelText('Local government area (optional)'), 'Eti-Osa');
    await user.type(screen.getByLabelText('Acquisition cost budget (optional)'), '750000000');
    await user.click(screen.getByRole('button', { name: 'Add parcel' }));

    expect(createParcelMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      code: 'LP-001',
      name: 'Riverside Parcel A',
      location: 'Lekki Phase 2',
      stateProvince: 'Lagos',
      localGovernmentArea: 'Eti-Osa',
      areaSqm: 50000,
      acquisitionCostBudget: 750000000,
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createParcelMock.mockResolvedValue({ ok: false, error: 'Parcel code already exists.' });
    const user = userEvent.setup();
    render(<CreateParcelForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add parcel' }));

    expect(await screen.findByText('Parcel code already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveValue('LP-001');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createParcelMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateParcelForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add parcel' }));

    expect(await screen.findByText('Failed to create land parcel.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createParcelMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateParcelForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Location (optional)'), 'Lekki Phase 2');
    await user.click(screen.getByRole('button', { name: 'Add parcel' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Location (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Area (sqm)')).toHaveValue(null);
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createParcelMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateParcelForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add parcel' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add parcel' })).not.toBeDisabled();
  });
});
