import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createVariationOrderMock = vi.fn();
vi.mock('../actions', () => ({
  createVariationOrder: (...args: unknown[]) => createVariationOrderMock(...args),
}));

import { CreateVariationOrderForm } from '../CreateVariationOrderForm';

beforeEach(() => {
  createVariationOrderMock.mockReset();
});

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { voNumber = 'VO-001', description = 'Additional groundwork', amount = '25000' }: { voNumber?: string; description?: string; amount?: string } = {},
) {
  await user.type(screen.getByLabelText('VO number'), voNumber);
  await user.type(screen.getByLabelText('Description'), description);
  await user.type(screen.getByLabelText('Amount'), amount);
}

describe('CreateVariationOrderForm', () => {
  it('renders every field', () => {
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    expect(screen.getByLabelText('VO number')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create variation order' })).toBeInTheDocument();
  });

  it('marks every field as required', () => {
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    expect(screen.getByLabelText('VO number')).toBeRequired();
    expect(screen.getByLabelText('Description')).toBeRequired();
    expect(screen.getByLabelText('Amount')).toBeRequired();
  });

  it('does not set a min bound on Amount — a variation order can be a deduction', () => {
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    expect(screen.getByLabelText('Amount')).not.toHaveAttribute('min');
  });

  it('submits with numeric amount conversion and workPackageId included in the payload', async () => {
    createVariationOrderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create variation order' }));

    expect(createVariationOrderMock).toHaveBeenCalledWith({
      workPackageId: 'wp-1',
      voNumber: 'VO-001',
      description: 'Additional groundwork',
      amount: 25000,
    });
  });

  it('submits a negative amount correctly (a deduction)', async () => {
    createVariationOrderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    await fillForm(user, { amount: '-5000' });
    await user.click(screen.getByRole('button', { name: 'Create variation order' }));

    expect(createVariationOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: -5000 }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createVariationOrderMock.mockResolvedValue({ ok: false, error: 'Variation order "VO-001" already exists on this work package' });
    const user = userEvent.setup();
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create variation order' }));

    expect(await screen.findByText('Variation order "VO-001" already exists on this work package')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createVariationOrderMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create variation order' }));

    expect(await screen.findByText('Failed to create variation order.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createVariationOrderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create variation order' }));

    expect(await screen.findByLabelText('VO number')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Amount')).toHaveValue(null);
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createVariationOrderMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateVariationOrderForm workPackageId="wp-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create variation order' }));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create variation order' })).not.toBeDisabled();
  });
});
