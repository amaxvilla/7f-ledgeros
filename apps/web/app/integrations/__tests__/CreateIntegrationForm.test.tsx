import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createIntegrationProviderMock = vi.fn();
vi.mock('../actions', () => ({
  createIntegrationProvider: (...args: unknown[]) => createIntegrationProviderMock(...args),
}));

import { CreateIntegrationForm } from '../CreateIntegrationForm';

beforeEach(() => {
  createIntegrationProviderMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Provider code'), 'TWILIO');
  await user.type(screen.getByLabelText('Name'), 'Twilio SMS');
}

describe('CreateIntegrationForm', () => {
  it('renders every field with its label, defaulting category to Microsoft Graph', () => {
    render(<CreateIntegrationForm />);

    expect(screen.getByLabelText('Category')).toHaveValue('MICROSOFT_GRAPH');
    expect(screen.getByLabelText('Provider code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Entity ID (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add integration' })).toBeInTheDocument();
  });

  it('marks only provider code and name as required', () => {
    render(<CreateIntegrationForm />);

    expect(screen.getByLabelText('Provider code')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Entity ID (optional)')).not.toBeRequired();
  });

  it('submits with entityId omitted (undefined, not an empty string) when left blank', async () => {
    createIntegrationProviderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIntegrationForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add integration' }));

    expect(createIntegrationProviderMock).toHaveBeenCalledWith({
      category: 'MICROSOFT_GRAPH',
      providerCode: 'TWILIO',
      name: 'Twilio SMS',
      entityId: undefined,
    });
  });

  it('includes the selected category and entityId when filled in', async () => {
    createIntegrationProviderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIntegrationForm />);

    await user.selectOptions(screen.getByLabelText('Category'), 'SMS');
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Entity ID (optional)'), 'ent-1');
    await user.click(screen.getByRole('button', { name: 'Add integration' }));

    expect(createIntegrationProviderMock).toHaveBeenCalledWith({
      category: 'SMS',
      providerCode: 'TWILIO',
      name: 'Twilio SMS',
      entityId: 'ent-1',
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createIntegrationProviderMock.mockResolvedValue({ ok: false, error: 'This provider code already exists for this category' });
    const user = userEvent.setup();
    render(<CreateIntegrationForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add integration' }));

    expect(await screen.findByText('This provider code already exists for this category')).toBeInTheDocument();
    expect(screen.getByLabelText('Provider code')).toHaveValue('TWILIO');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createIntegrationProviderMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateIntegrationForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add integration' }));

    expect(await screen.findByText('Failed to create integration.')).toBeInTheDocument();
  });

  it('resets providerCode/name/entityId (but not category) after a successful submit', async () => {
    createIntegrationProviderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIntegrationForm />);

    await user.selectOptions(screen.getByLabelText('Category'), 'SMS');
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Entity ID (optional)'), 'ent-1');
    await user.click(screen.getByRole('button', { name: 'Add integration' }));

    expect(await screen.findByLabelText('Provider code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Entity ID (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Category')).toHaveValue('SMS');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createIntegrationProviderMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateIntegrationForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add integration' }));

    const pendingButton = screen.getByRole('button', { name: 'Creating…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add integration' })).not.toBeDisabled();
  });
});
