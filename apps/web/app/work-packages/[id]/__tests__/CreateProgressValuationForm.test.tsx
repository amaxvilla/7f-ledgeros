import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createProgressValuationMock = vi.fn();
vi.mock('../actions', () => ({
  createProgressValuation: (...args: unknown[]) => createProgressValuationMock(...args),
}));

import { CreateProgressValuationForm } from '../CreateProgressValuationForm';

beforeEach(() => {
  createProgressValuationMock.mockReset();
});

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { valuationDate = '2026-08-01', percentComplete = '35', valuationAmount = '250000' }: { valuationDate?: string; percentComplete?: string; valuationAmount?: string } = {},
) {
  await user.type(screen.getByLabelText('Valuation date'), valuationDate);
  await user.type(screen.getByLabelText('Percent complete'), percentComplete);
  await user.type(screen.getByLabelText('Valuation amount'), valuationAmount);
}

describe('CreateProgressValuationForm', () => {
  it('renders every field', () => {
    render(<CreateProgressValuationForm workPackageId="wp-1" />);

    expect(screen.getByLabelText('Valuation date')).toBeInTheDocument();
    expect(screen.getByLabelText('Percent complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Valuation amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add progress valuation' })).toBeInTheDocument();
  });

  it('submits with numeric percentComplete/valuationAmount conversion and the workPackageId prop', async () => {
    createProgressValuationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateProgressValuationForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Add progress valuation' }));

    expect(createProgressValuationMock).toHaveBeenCalledWith({
      workPackageId: 'wp-1',
      valuationDate: '2026-08-01',
      percentComplete: 35,
      valuationAmount: 250000,
    });
  });

  it('shows the action-returned error message on failure', async () => {
    createProgressValuationMock.mockResolvedValue({ ok: false, error: 'Percent complete must be between 0 and 100' });
    const user = userEvent.setup();
    render(<CreateProgressValuationForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Add progress valuation' }));

    expect(await screen.findByText('Percent complete must be between 0 and 100')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createProgressValuationMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateProgressValuationForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Add progress valuation' }));

    expect(await screen.findByText('Failed to create progress valuation.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createProgressValuationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateProgressValuationForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Add progress valuation' }));

    expect(await screen.findByLabelText('Valuation date')).toHaveValue('');
    expect(screen.getByLabelText('Percent complete')).toHaveValue(null);
    expect(screen.getByLabelText('Valuation amount')).toHaveValue(null);
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createProgressValuationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateProgressValuationForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Add progress valuation' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add progress valuation' })).not.toBeDisabled();
  });
});
