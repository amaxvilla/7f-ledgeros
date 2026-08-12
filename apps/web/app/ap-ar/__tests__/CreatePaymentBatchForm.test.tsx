import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createPaymentBatchMock = vi.fn();
vi.mock('../actions', () => ({
  createPaymentBatch: (...args: unknown[]) => createPaymentBatchMock(...args),
}));

import { CreatePaymentBatchForm } from '../CreatePaymentBatchForm';

beforeEach(() => {
  createPaymentBatchMock.mockReset();
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Batch number'), 'BATCH-001');
  await user.type(screen.getByLabelText('Payment date'), '2026-08-15');
}

describe('CreatePaymentBatchForm', () => {
  it('renders both fields and the submit button', () => {
    render(<CreatePaymentBatchForm entityId="ent-1" />);

    expect(screen.getByLabelText('Batch number')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create payment batch' })).toBeInTheDocument();
  });

  it('submits entityId and the entered values to createPaymentBatch', async () => {
    createPaymentBatchMock.mockResolvedValue({ ok: true, batchId: 'batch-1' });
    const user = userEvent.setup();
    render(<CreatePaymentBatchForm entityId="ent-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create payment batch' }));

    expect(createPaymentBatchMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      batchNumber: 'BATCH-001',
      paymentDate: '2026-08-15',
    });
  });

  it('displays the returned batchId on success, since there is nowhere else to find it', async () => {
    createPaymentBatchMock.mockResolvedValue({ ok: true, batchId: 'batch-abc-123' });
    const user = userEvent.setup();
    render(<CreatePaymentBatchForm entityId="ent-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create payment batch' }));

    expect(await screen.findByText('batch-abc-123')).toBeInTheDocument();
  });

  it('resets the form fields after a successful submit', async () => {
    createPaymentBatchMock.mockResolvedValue({ ok: true, batchId: 'batch-1' });
    const user = userEvent.setup();
    render(<CreatePaymentBatchForm entityId="ent-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create payment batch' }));

    expect(await screen.findByText('batch-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Batch number')).toHaveValue('');
    expect(screen.getByLabelText('Payment date')).toHaveValue('');
  });

  it('shows the returned error message on failure', async () => {
    createPaymentBatchMock.mockResolvedValue({ ok: false, error: 'Batch BATCH-001 already exists for this entity' });
    const user = userEvent.setup();
    render(<CreatePaymentBatchForm entityId="ent-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create payment batch' }));

    expect(await screen.findByText('Batch BATCH-001 already exists for this entity')).toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean; batchId?: string }) => void = () => {};
    createPaymentBatchMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreatePaymentBatchForm entityId="ent-1" />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create payment batch' }));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();

    resolveAction({ ok: true, batchId: 'batch-1' });
    expect(await screen.findByRole('button', { name: 'Create payment batch' })).not.toBeDisabled();
  });
});
