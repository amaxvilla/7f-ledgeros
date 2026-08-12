import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const releaseRetentionMock = vi.fn();
vi.mock('../actions', () => ({
  releaseRetention: (...args: unknown[]) => releaseRetentionMock(...args),
}));

import { ReleaseRetentionForm } from '../ReleaseRetentionForm';

beforeEach(() => {
  releaseRetentionMock.mockReset();
});

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { amount = '5000', releaseDate = '2026-08-01' }: { amount?: string; releaseDate?: string } = {},
) {
  await user.type(screen.getByLabelText('Amount to release'), amount);
  await user.type(screen.getByLabelText('Release date'), releaseDate);
}

describe('ReleaseRetentionForm', () => {
  it('renders every field', () => {
    render(<ReleaseRetentionForm retentionId="ret-1" workPackageId="wp-1" />);

    expect(screen.getByLabelText('Amount to release')).toBeInTheDocument();
    expect(screen.getByLabelText('Release date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release retention' })).toBeInTheDocument();
  });

  it('marks both fields as required', () => {
    render(<ReleaseRetentionForm retentionId="ret-1" workPackageId="wp-1" />);

    expect(screen.getByLabelText('Amount to release')).toBeRequired();
    expect(screen.getByLabelText('Release date')).toBeRequired();
  });

  it('submits with numeric amount conversion and both id props, but not amount/releaseDate in a nested body', async () => {
    releaseRetentionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReleaseRetentionForm retentionId="ret-1" workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Release retention' }));

    expect(releaseRetentionMock).toHaveBeenCalledWith({
      retentionId: 'ret-1',
      workPackageId: 'wp-1',
      amount: 5000,
      releaseDate: '2026-08-01',
    });
  });

  it('shows the action-returned error message on failure', async () => {
    releaseRetentionMock.mockResolvedValue({ ok: false, error: 'Cannot release 5000: only 3000 of retention is available' });
    const user = userEvent.setup();
    render(<ReleaseRetentionForm retentionId="ret-1" workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Release retention' }));

    expect(await screen.findByText('Cannot release 5000: only 3000 of retention is available')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    releaseRetentionMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ReleaseRetentionForm retentionId="ret-1" workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Release retention' }));

    expect(await screen.findByText('Failed to release retention.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    releaseRetentionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReleaseRetentionForm retentionId="ret-1" workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Release retention' }));

    expect(await screen.findByLabelText('Amount to release')).toHaveValue(null);
    expect(screen.getByLabelText('Release date')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    releaseRetentionMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<ReleaseRetentionForm retentionId="ret-1" workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Release retention' }));

    expect(screen.getByRole('button', { name: 'Releasing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Release retention' })).not.toBeDisabled();
  });
});
