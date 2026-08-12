import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same reasoning as every other Create*Form test's ../actions mock (see
// CreatePaymentLinkForm.test.tsx).
const createFixedAssetMock = vi.fn();
vi.mock('../actions', () => ({
  createFixedAsset: (...args: unknown[]) => createFixedAssetMock(...args),
}));

import { CreateFixedAssetForm } from '../CreateFixedAssetForm';

beforeEach(() => {
  createFixedAssetMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Asset category ID'), 'cat-uuid-1');
  await user.type(screen.getByLabelText('Asset tag'), 'FA-0042');
  await user.type(screen.getByLabelText('Name'), 'Toyota Hilux');
  await user.type(screen.getByLabelText('Acquisition date'), '2026-01-15');
  await user.type(screen.getByLabelText('Acquisition cost'), '25000');
  await user.type(screen.getByLabelText('Useful life (years)'), '5');
}

describe('CreateFixedAssetForm', () => {
  it('renders every field with its label', () => {
    render(<CreateFixedAssetForm entityId="ent-1" />);

    expect(screen.getByLabelText('Asset category ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Asset tag')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Acquisition date')).toBeInTheDocument();
    expect(screen.getByLabelText('Acquisition cost')).toBeInTheDocument();
    expect(screen.getByLabelText('Useful life (years)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add fixed asset' })).toBeInTheDocument();
  });

  it('marks every field required', () => {
    render(<CreateFixedAssetForm entityId="ent-1" />);

    expect(screen.getByLabelText('Asset category ID')).toBeRequired();
    expect(screen.getByLabelText('Asset tag')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Acquisition date')).toBeRequired();
    expect(screen.getByLabelText('Acquisition cost')).toBeRequired();
    expect(screen.getByLabelText('Useful life (years)')).toBeRequired();
  });

  it('converts acquisitionCost and usefulLifeYears to numbers before calling the action', async () => {
    createFixedAssetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateFixedAssetForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add fixed asset' }));

    expect(createFixedAssetMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      assetCategoryId: 'cat-uuid-1',
      assetTag: 'FA-0042',
      name: 'Toyota Hilux',
      acquisitionDate: '2026-01-15',
      acquisitionCost: 25000,
      usefulLifeYears: 5,
    });
  });

  it('passes the entityId prop through as entered', async () => {
    createFixedAssetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateFixedAssetForm entityId="ent-99" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add fixed asset' }));

    expect(createFixedAssetMock).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'ent-99' }));
  });

  it('shows the action-returned error message on failure', async () => {
    createFixedAssetMock.mockResolvedValue({ ok: false, error: 'assetTag must be unique' });
    const user = userEvent.setup();
    render(<CreateFixedAssetForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add fixed asset' }));

    expect(await screen.findByText('assetTag must be unique')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createFixedAssetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateFixedAssetForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add fixed asset' }));

    expect(await screen.findByLabelText('Asset category ID')).toHaveValue('');
    expect(screen.getByLabelText('Asset tag')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Acquisition date')).toHaveValue('');
    expect(screen.getByLabelText('Acquisition cost')).toHaveValue(null);
    expect(screen.getByLabelText('Useful life (years)')).toHaveValue(null);
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createFixedAssetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateFixedAssetForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add fixed asset' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add fixed asset' })).not.toBeDisabled();
  });
});
