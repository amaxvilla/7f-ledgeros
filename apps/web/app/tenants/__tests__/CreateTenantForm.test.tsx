import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createTenantMock = vi.fn();
vi.mock('../actions', () => ({
  createTenant: (...args: unknown[]) => createTenantMock(...args),
}));

import { CreateTenantForm } from '../CreateTenantForm';

beforeEach(() => {
  createTenantMock.mockReset();
});

const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const UNIT_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Customer ID'), CUSTOMER_UUID);
  await user.type(screen.getByLabelText('Unit ID'), UNIT_UUID);
  await user.type(screen.getByLabelText('Move-in date'), '2026-02-01');
}

describe('CreateTenantForm', () => {
  it('renders every field with its label', () => {
    render(<CreateTenantForm entityId="ent-1" />);

    expect(screen.getByLabelText('Customer ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Move-in date')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add tenant' })).toBeInTheDocument();
  });

  it('marks every field required except notes', () => {
    render(<CreateTenantForm entityId="ent-1" />);

    expect(screen.getByLabelText('Customer ID')).toBeRequired();
    expect(screen.getByLabelText('Unit ID')).toBeRequired();
    expect(screen.getByLabelText('Move-in date')).toBeRequired();
    expect(screen.getByLabelText('Notes (optional)')).not.toBeRequired();
  });

  it('omits notes when left blank', async () => {
    createTenantMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTenantForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add tenant' }));

    expect(createTenantMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      customerId: CUSTOMER_UUID,
      unitId: UNIT_UUID,
      moveInDate: '2026-02-01',
      notes: undefined,
    });
  });

  it('includes notes when provided, and passes entityId through as entered', async () => {
    createTenantMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTenantForm entityId="ent-77" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Notes (optional)'), 'Prefers ground floor');
    await user.click(screen.getByRole('button', { name: 'Add tenant' }));

    expect(createTenantMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'ent-77', notes: 'Prefers ground floor' }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createTenantMock.mockResolvedValue({ ok: false, error: 'unit is not available' });
    const user = userEvent.setup();
    render(<CreateTenantForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add tenant' }));

    expect(await screen.findByText('unit is not available')).toBeInTheDocument();
  });

  it('blocks submission and shows per-field errors when required fields are left blank', async () => {
    const user = userEvent.setup();
    render(<CreateTenantForm entityId="ent-1" />);

    await user.click(screen.getByRole('button', { name: 'Add tenant' }));

    expect(await screen.findByText('Customer ID is required')).toBeInTheDocument();
    expect(screen.getByText('Unit ID is required')).toBeInTheDocument();
    expect(screen.getByText('Move-in date is required')).toBeInTheDocument();
    expect(createTenantMock).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an error when Customer ID is not UUID-shaped', async () => {
    const user = userEvent.setup();
    render(<CreateTenantForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Customer ID'), 'not-a-real-id');
    await user.type(screen.getByLabelText('Unit ID'), UNIT_UUID);
    await user.type(screen.getByLabelText('Move-in date'), '2026-02-01');
    await user.click(screen.getByRole('button', { name: 'Add tenant' }));

    expect(await screen.findByText('Enter a valid ID (expected a UUID)')).toBeInTheDocument();
    expect(createTenantMock).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is edited', async () => {
    const user = userEvent.setup();
    render(<CreateTenantForm entityId="ent-1" />);

    await user.click(screen.getByRole('button', { name: 'Add tenant' }));
    expect(await screen.findByText('Customer ID is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Customer ID'), CUSTOMER_UUID);
    expect(screen.queryByText('Customer ID is required')).not.toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createTenantMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTenantForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Notes (optional)'), 'note');
    await user.click(screen.getByRole('button', { name: 'Add tenant' }));

    expect(await screen.findByLabelText('Customer ID')).toHaveValue('');
    expect(screen.getByLabelText('Unit ID')).toHaveValue('');
    expect(screen.getByLabelText('Move-in date')).toHaveValue('');
    expect(screen.getByLabelText('Notes (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createTenantMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateTenantForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add tenant' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add tenant' })).not.toBeDisabled();
  });
});
