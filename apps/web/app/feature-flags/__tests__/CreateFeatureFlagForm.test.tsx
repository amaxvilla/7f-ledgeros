import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const upsertFeatureFlagMock = vi.fn();
vi.mock('../actions', () => ({
  upsertFeatureFlag: (...args: unknown[]) => upsertFeatureFlagMock(...args),
}));

import { CreateFeatureFlagForm } from '../CreateFeatureFlagForm';

beforeEach(() => {
  upsertFeatureFlagMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Key'), 'billing.v2');
}

describe('CreateFeatureFlagForm', () => {
  it('renders every field, defaulting status to Disabled', () => {
    render(<CreateFeatureFlagForm />);

    expect(screen.getByLabelText('Key')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('false');
    expect(screen.getByLabelText('Rollout % (optional)')).toBeInTheDocument();
  });

  it('marks only Key as required', () => {
    render(<CreateFeatureFlagForm />);

    expect(screen.getByLabelText('Key')).toBeRequired();
    expect(screen.getByLabelText('Description (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Rollout % (optional)')).not.toBeRequired();
  });

  it('submits the key and values, omitting description/rolloutPercent as undefined when blank', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateFeatureFlagForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add flag' }));

    expect(upsertFeatureFlagMock).toHaveBeenCalledWith('billing.v2', {
      enabled: false,
      description: undefined,
      rolloutPercent: undefined,
    });
  });

  it('includes description/rolloutPercent, with numeric conversion, when filled in', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateFeatureFlagForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Description (optional)'), 'New billing flow');
    await user.selectOptions(screen.getByLabelText('Status'), 'true');
    await user.type(screen.getByLabelText('Rollout % (optional)'), '25');
    await user.click(screen.getByRole('button', { name: 'Add flag' }));

    expect(upsertFeatureFlagMock).toHaveBeenCalledWith('billing.v2', {
      enabled: true,
      description: 'New billing flow',
      rolloutPercent: 25,
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: false, error: 'A flag with key billing.v2 already exists' });
    const user = userEvent.setup();
    render(<CreateFeatureFlagForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add flag' }));

    expect(await screen.findByText('A flag with key billing.v2 already exists')).toBeInTheDocument();
    expect(screen.getByLabelText('Key')).toHaveValue('billing.v2');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateFeatureFlagForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add flag' }));

    expect(await screen.findByText('Failed to create feature flag.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateFeatureFlagForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Description (optional)'), 'New billing flow');
    await user.selectOptions(screen.getByLabelText('Status'), 'true');
    await user.click(screen.getByRole('button', { name: 'Add flag' }));

    expect(await screen.findByLabelText('Key')).toHaveValue('');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('false');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    upsertFeatureFlagMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateFeatureFlagForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add flag' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add flag' })).not.toBeDisabled();
  });
});
