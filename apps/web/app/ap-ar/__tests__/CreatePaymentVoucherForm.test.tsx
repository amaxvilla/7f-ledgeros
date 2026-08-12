import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createPaymentVoucherMock = vi.fn();
vi.mock('../actions', () => ({
  createPaymentVoucher: (...args: unknown[]) => createPaymentVoucherMock(...args),
}));

import { CreatePaymentVoucherForm } from '../CreatePaymentVoucherForm';

const VENDOR_OPTIONS = [{ value: 'vendor-1', label: 'V-001 — Acme Supplies' }];
const INVOICE_OPTIONS = [
  { value: 'inv-1', label: 'INV-001' },
  { value: 'inv-2', label: 'INV-002' },
];

beforeEach(() => {
  createPaymentVoucherMock.mockReset();
});

async function fillHeaderFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Voucher number'), 'PV-001');
  await user.selectOptions(screen.getByLabelText('Vendor'), 'vendor-1');
  await user.type(screen.getByLabelText('Payment date'), '2026-08-15');
  await user.selectOptions(screen.getByLabelText('Payment method'), 'BANK_TRANSFER');
  await user.type(screen.getByLabelText('Bank account ID'), 'bank-acc-1');
}

describe('CreatePaymentVoucherForm', () => {
  it('renders header fields and one allocation row by default', () => {
    render(<CreatePaymentVoucherForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} invoiceOptions={INVOICE_OPTIONS} />);

    expect(screen.getByLabelText('Voucher number')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor')).toBeInTheDocument();
    expect(screen.getByLabelText('Batch ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment method')).toBeInTheDocument();
    expect(screen.getByLabelText('Bank account ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor invoice (line 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Vendor invoice (line 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('adds and removes allocation rows', async () => {
    const user = userEvent.setup();
    render(<CreatePaymentVoucherForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} invoiceOptions={INVOICE_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add allocation' }));
    expect(screen.getByLabelText('Vendor invoice (line 2)')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.queryByLabelText('Vendor invoice (line 2)')).not.toBeInTheDocument();
  });

  it('submits entityId (from props), header fields, and allocations with amounts coerced to numbers', async () => {
    createPaymentVoucherMock.mockResolvedValue({ ok: true, voucherId: 'pv-1' });
    const user = userEvent.setup();
    render(<CreatePaymentVoucherForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} invoiceOptions={INVOICE_OPTIONS} />);

    await fillHeaderFields(user);
    await user.selectOptions(screen.getByLabelText('Vendor invoice (line 1)'), 'inv-1');
    await user.type(screen.getByLabelText('Amount allocated'), '500');
    await user.click(screen.getByRole('button', { name: 'Create payment voucher' }));

    expect(createPaymentVoucherMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      voucherNumber: 'PV-001',
      vendorId: 'vendor-1',
      batchId: undefined,
      paymentDate: '2026-08-15',
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: 'bank-acc-1',
      allocations: [{ vendorInvoiceId: 'inv-1', amountAllocated: 500 }],
    });
  });

  it('includes batchId when entered', async () => {
    createPaymentVoucherMock.mockResolvedValue({ ok: true, voucherId: 'pv-1' });
    const user = userEvent.setup();
    render(<CreatePaymentVoucherForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} invoiceOptions={INVOICE_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Batch ID (optional)'), 'batch-1');
    await user.selectOptions(screen.getByLabelText('Vendor invoice (line 1)'), 'inv-1');
    await user.type(screen.getByLabelText('Amount allocated'), '500');
    await user.click(screen.getByRole('button', { name: 'Create payment voucher' }));

    expect(createPaymentVoucherMock.mock.calls[0][0].batchId).toBe('batch-1');
  });

  it('displays the returned voucherId on success', async () => {
    createPaymentVoucherMock.mockResolvedValue({ ok: true, voucherId: 'pv-abc-123' });
    const user = userEvent.setup();
    render(<CreatePaymentVoucherForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} invoiceOptions={INVOICE_OPTIONS} />);

    await fillHeaderFields(user);
    await user.selectOptions(screen.getByLabelText('Vendor invoice (line 1)'), 'inv-1');
    await user.type(screen.getByLabelText('Amount allocated'), '500');
    await user.click(screen.getByRole('button', { name: 'Create payment voucher' }));

    expect(await screen.findByText('pv-abc-123')).toBeInTheDocument();
  });

  it('resets the form, back to a single empty allocation, on success', async () => {
    createPaymentVoucherMock.mockResolvedValue({ ok: true, voucherId: 'pv-1' });
    const user = userEvent.setup();
    render(<CreatePaymentVoucherForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} invoiceOptions={INVOICE_OPTIONS} />);

    await fillHeaderFields(user);
    await user.selectOptions(screen.getByLabelText('Vendor invoice (line 1)'), 'inv-1');
    await user.type(screen.getByLabelText('Amount allocated'), '500');
    await user.click(screen.getByRole('button', { name: 'Create payment voucher' }));

    expect(await screen.findByText('pv-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Voucher number')).toHaveValue('');
    expect(screen.queryByLabelText('Vendor invoice (line 2)')).not.toBeInTheDocument();
  });

  it('shows the returned error message on failure', async () => {
    createPaymentVoucherMock.mockResolvedValue({ ok: false, error: 'A payment voucher needs at least one invoice allocation' });
    const user = userEvent.setup();
    render(<CreatePaymentVoucherForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} invoiceOptions={INVOICE_OPTIONS} />);

    await fillHeaderFields(user);
    await user.selectOptions(screen.getByLabelText('Vendor invoice (line 1)'), 'inv-1');
    await user.type(screen.getByLabelText('Amount allocated'), '500');
    await user.click(screen.getByRole('button', { name: 'Create payment voucher' }));

    expect(await screen.findByText('A payment voucher needs at least one invoice allocation')).toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean; voucherId?: string }) => void = () => {};
    createPaymentVoucherMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreatePaymentVoucherForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} invoiceOptions={INVOICE_OPTIONS} />);

    await fillHeaderFields(user);
    await user.selectOptions(screen.getByLabelText('Vendor invoice (line 1)'), 'inv-1');
    await user.type(screen.getByLabelText('Amount allocated'), '500');
    await user.click(screen.getByRole('button', { name: 'Create payment voucher' }));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    resolveAction({ ok: true, voucherId: 'pv-1' });
    expect(await screen.findByRole('button', { name: 'Create payment voucher' })).not.toBeDisabled();
  });
});
