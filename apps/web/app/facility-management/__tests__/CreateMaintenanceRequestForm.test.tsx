import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createMaintenanceRequestMock = vi.fn();
vi.mock('../actions', () => ({
  createMaintenanceRequest: (...args: unknown[]) => createMaintenanceRequestMock(...args),
}));

import { CreateMaintenanceRequestForm } from '../CreateMaintenanceRequestForm';

beforeEach(() => {
  createMaintenanceRequestMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Category'), 'ELECTRICAL');
  await user.type(screen.getByLabelText('Description'), 'Flickering lights in lobby');
}

describe('CreateMaintenanceRequestForm', () => {
  it('renders every field with its label', () => {
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);

    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Facility ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Target resolution (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log request' })).toBeInTheDocument();
  });

  it('marks category and description as required, priority and the rest optional', () => {
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);

    expect(screen.getByLabelText('Category')).toBeRequired();
    expect(screen.getByLabelText('Description')).toBeRequired();
    expect(screen.getByLabelText('Priority')).not.toBeRequired();
    expect(screen.getByLabelText('Facility ID (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Target resolution (optional)')).not.toBeRequired();
  });

  it('offers all eight category options', () => {
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(['MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'SECURITY', 'STRUCTURAL', 'AMENITY', 'OTHER']);
  });

  it('submits with priority left unselected as undefined, letting the server default it', async () => {
    createMaintenanceRequestMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log request' }));

    expect(createMaintenanceRequestMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      category: 'ELECTRICAL',
      description: 'Flickering lights in lobby',
      priority: undefined,
      facilityId: undefined,
      targetResolutionDate: undefined,
    });
  });

  it('includes priority, facilityId, and targetResolutionDate when filled in', async () => {
    createMaintenanceRequestMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText('Priority'), 'URGENT');
    await user.type(screen.getByLabelText('Facility ID (optional)'), 'fac-9');
    await user.type(screen.getByLabelText('Target resolution (optional)'), '2026-08-15');
    await user.click(screen.getByRole('button', { name: 'Log request' }));

    expect(createMaintenanceRequestMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      category: 'ELECTRICAL',
      description: 'Flickering lights in lobby',
      priority: 'URGENT',
      facilityId: 'fac-9',
      targetResolutionDate: '2026-08-15',
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createMaintenanceRequestMock.mockResolvedValue({ ok: false, error: 'Facility ID does not exist' });
    const user = userEvent.setup();
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log request' }));

    expect(await screen.findByText('Facility ID does not exist')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Flickering lights in lobby');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createMaintenanceRequestMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log request' }));

    expect(await screen.findByText('Failed to create maintenance request.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createMaintenanceRequestMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Facility ID (optional)'), 'fac-9');
    await user.click(screen.getByRole('button', { name: 'Log request' }));

    expect(await screen.findByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Facility ID (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createMaintenanceRequestMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateMaintenanceRequestForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log request' }));

    const pendingButton = screen.getByRole('button', { name: 'Submitting…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Log request' })).not.toBeDisabled();
  });
});
