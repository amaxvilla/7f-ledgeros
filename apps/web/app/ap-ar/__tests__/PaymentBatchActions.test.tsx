import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const approvePaymentBatchMock = vi.fn();
const processPaymentBatchMock = vi.fn();
vi.mock('../actions', () => ({
  approvePaymentBatch: (...args: unknown[]) => approvePaymentBatchMock(...args),
  processPaymentBatch: (...args: unknown[]) => processPaymentBatchMock(...args),
}));

import { PaymentBatchActions } from '../PaymentBatchActions';

const ACCOUNT_OPTIONS = [
  { value: 'acc-ap-control', label: '2100 — Accounts Payable Control' },
  { value: 'acc-cash', label: '1000 — Operating Cash' },
];

beforeEach(() => {
  approvePaymentBatchMock.mockReset();
  processPaymentBatchMock.mockReset();
});

describe('PaymentBatchActions — batch id entry', () => {
  it('disables both action buttons until a batch id is entered', () => {
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('button', { name: 'Approve batch' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Process batch' })).toBeDisabled();
  });

  it('enables both action buttons once a batch id is entered', async () => {
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');

    expect(screen.getByRole('button', { name: 'Approve batch' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Process batch' })).not.toBeDisabled();
  });
});

describe('PaymentBatchActions — approve', () => {
  it('submits the entered batch id to approvePaymentBatch', async () => {
    approvePaymentBatchMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.click(screen.getByRole('button', { name: 'Approve batch' }));

    expect(approvePaymentBatchMock).toHaveBeenCalledWith('batch-1');
  });

  it('shows a confirmation on success', async () => {
    approvePaymentBatchMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.click(screen.getByRole('button', { name: 'Approve batch' }));

    expect(await screen.findByText('Approved.')).toBeInTheDocument();
  });

  it('shows the returned error message on failure (e.g. the maker-checker guard)', async () => {
    approvePaymentBatchMock.mockResolvedValue({ ok: false, error: 'The preparer of a payment batch cannot also approve it' });
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.click(screen.getByRole('button', { name: 'Approve batch' }));

    expect(await screen.findByText('The preparer of a payment batch cannot also approve it')).toBeInTheDocument();
  });
});

describe('PaymentBatchActions — process', () => {
  it('requires both accounts before submitting', async () => {
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.click(screen.getByRole('button', { name: 'Process batch' }));

    expect(processPaymentBatchMock).not.toHaveBeenCalled();
    expect(await screen.findByText('Select both an AP control account and a cash GL account first.')).toBeInTheDocument();
  });

  it('submits the batch id and both selected accounts to processPaymentBatch', async () => {
    processPaymentBatchMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.selectOptions(screen.getByLabelText('AP control account'), 'acc-ap-control');
    await user.selectOptions(screen.getByLabelText('Cash / bank GL account'), 'acc-cash');
    await user.click(screen.getByRole('button', { name: 'Process batch' }));

    expect(processPaymentBatchMock).toHaveBeenCalledWith('batch-1', 'acc-ap-control', 'acc-cash');
  });

  it('shows a confirmation on success', async () => {
    processPaymentBatchMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.selectOptions(screen.getByLabelText('AP control account'), 'acc-ap-control');
    await user.selectOptions(screen.getByLabelText('Cash / bank GL account'), 'acc-cash');
    await user.click(screen.getByRole('button', { name: 'Process batch' }));

    expect(await screen.findByText('Processed.')).toBeInTheDocument();
  });

  it('shows the returned error message on failure', async () => {
    processPaymentBatchMock.mockResolvedValue({ ok: false, error: 'Cannot process a batch with status DRAFT' });
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.selectOptions(screen.getByLabelText('AP control account'), 'acc-ap-control');
    await user.selectOptions(screen.getByLabelText('Cash / bank GL account'), 'acc-cash');
    await user.click(screen.getByRole('button', { name: 'Process batch' }));

    expect(await screen.findByText('Cannot process a batch with status DRAFT')).toBeInTheDocument();
  });

  it('disables the process button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    processPaymentBatchMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.selectOptions(screen.getByLabelText('AP control account'), 'acc-ap-control');
    await user.selectOptions(screen.getByLabelText('Cash / bank GL account'), 'acc-cash');
    await user.click(screen.getByRole('button', { name: 'Process batch' }));

    expect(screen.getByRole('button', { name: 'Processing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Process batch' })).not.toBeDisabled();
  });
});

describe('PaymentBatchActions — changing the batch id', () => {
  it('clears a prior success message when the batch id is edited', async () => {
    approvePaymentBatchMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PaymentBatchActions accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Batch ID'), 'batch-1');
    await user.click(screen.getByRole('button', { name: 'Approve batch' }));
    expect(await screen.findByText('Approved.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Batch ID'), '-more');
    expect(screen.queryByText('Approved.')).not.toBeInTheDocument();
  });
});
