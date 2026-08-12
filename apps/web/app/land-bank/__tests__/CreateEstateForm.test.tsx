import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createEstateMock = vi.fn();
vi.mock('../actions', () => ({
  createEstate: (...args: unknown[]) => createEstateMock(...args),
}));

import { CreateEstateForm } from '../CreateEstateForm';

beforeEach(() => {
  createEstateMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Code'), 'EST-001');
  await user.type(screen.getByLabelText('Name'), 'Riverside Gardens Estate');
}

describe('CreateEstateForm', () => {
  it('renders every field', () => {
    render(<CreateEstateForm entityId="ent-1" />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Location (optional)')).toBeInTheDocument();
  });

  it('marks only Code/Name as required', () => {
    render(<CreateEstateForm entityId="ent-1" />);

    expect(screen.getByLabelText('Code')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Description (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Location (optional)')).not.toBeRequired();
  });

  it('submits entityId and the entered values, with optional fields omitted as undefined when blank', async () => {
    createEstateMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateEstateForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add estate' }));

    expect(createEstateMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      code: 'EST-001',
      name: 'Riverside Gardens Estate',
      description: undefined,
      location: undefined,
    });
  });

  it('includes optional fields when filled in', async () => {
    createEstateMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateEstateForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Description (optional)'), 'Master-planned residential estate');
    await user.type(screen.getByLabelText('Location (optional)'), 'Lekki Phase 2');
    await user.click(screen.getByRole('button', { name: 'Add estate' }));

    expect(createEstateMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      code: 'EST-001',
      name: 'Riverside Gardens Estate',
      description: 'Master-planned residential estate',
      location: 'Lekki Phase 2',
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createEstateMock.mockResolvedValue({ ok: false, error: 'Estate code already exists for this entity' });
    const user = userEvent.setup();
    render(<CreateEstateForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add estate' }));

    expect(await screen.findByText('Estate code already exists for this entity')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveValue('EST-001');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createEstateMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateEstateForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add estate' }));

    expect(await screen.findByText('Failed to create estate.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createEstateMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateEstateForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Location (optional)'), 'Lekki Phase 2');
    await user.click(screen.getByRole('button', { name: 'Add estate' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Location (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createEstateMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateEstateForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add estate' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add estate' })).not.toBeDisabled();
  });
});
