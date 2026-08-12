import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createLeadMock = vi.fn();
vi.mock('../actions', () => ({
  createLead: (...args: unknown[]) => createLeadMock(...args),
}));

import { CreateLeadForm } from '../CreateLeadForm';

beforeEach(() => {
  createLeadMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Ada');
  await user.type(screen.getByLabelText('Last name'), 'Okafor');
}

describe('CreateLeadForm', () => {
  it('renders every field with its label', () => {
    render(<CreateLeadForm entityId="ent-1" />);

    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Source (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add lead' })).toBeInTheDocument();
  });

  it('marks only first/last name as required', () => {
    render(<CreateLeadForm entityId="ent-1" />);

    expect(screen.getByLabelText('First name')).toBeRequired();
    expect(screen.getByLabelText('Last name')).toBeRequired();
    expect(screen.getByLabelText('Email (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Phone (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Source (optional)')).not.toBeRequired();
  });

  it('submits with optional fields omitted (undefined, not empty strings) when left blank', async () => {
    createLeadMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(createLeadMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      firstName: 'Ada',
      lastName: 'Okafor',
      email: undefined,
      phone: undefined,
      source: undefined,
    });
  });

  it('includes optional fields, including the free-text source, when filled in', async () => {
    createLeadMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Email (optional)'), 'ada@example.com');
    await user.type(screen.getByLabelText('Phone (optional)'), '+2348012345678');
    await user.type(screen.getByLabelText('Source (optional)'), 'REFERRAL');
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(createLeadMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      firstName: 'Ada',
      lastName: 'Okafor',
      email: 'ada@example.com',
      phone: '+2348012345678',
      source: 'REFERRAL',
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createLeadMock.mockResolvedValue({ ok: false, error: 'A lead with this email already exists' });
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(await screen.findByText('A lead with this email already exists')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createLeadMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(await screen.findByText('Failed to create lead.')).toBeInTheDocument();
  });

  it('blocks submission and shows per-field errors when required fields are left blank', async () => {
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an error when the optional email is malformed', async () => {
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Email (optional)'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an error when the optional phone is malformed', async () => {
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Phone (optional)'), 'call me maybe');
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(await screen.findByText('Enter a valid phone number')).toBeInTheDocument();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is edited', async () => {
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await user.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(await screen.findByText('First name is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('First name'), 'A');
    expect(screen.queryByText('First name is required')).not.toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createLeadMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Email (optional)'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(await screen.findByLabelText('First name')).toHaveValue('');
    expect(screen.getByLabelText('Last name')).toHaveValue('');
    expect(screen.getByLabelText('Email (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createLeadMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateLeadForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add lead' })).not.toBeDisabled();
  });
});
