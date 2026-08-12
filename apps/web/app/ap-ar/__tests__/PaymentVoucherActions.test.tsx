import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const lookupPaymentVoucherMock = vi.fn();
const approvePaymentVoucherMock = vi.fn();
const postPaymentVoucherMock = vi.fn();
vi.mock('../actions', () => ({
  lookupPaymentVoucher: (...args: unknown[]) => lookupPaymentVoucherMock(...args),
  approvePaymentVoucher: (...args: unknown[]) => approvePaymentVoucherMock(...args),
  postPaymentVoucher: (...args: unknown[]) => postPaymentVoucherMock(...args),
}));

import { PaymentVoucherActions } from '../PaymentVoucherActions';

const ACCOUNT_OPTIONS = [{ value: 'acc-1', label: 'GL-001 — Cash' }];

beforeEach(() => {
  lookupPaymentVoucherMock.mockReset();
  approvePaymentVoucherMock.mockReset();
  postPaymentVoucherMock.mockReset();
});

async function lookUp(user: ReturnType<typeof userEvent.setup>, id = 'pv-1') {
  await user.type(screen.getByLabelText('Voucher ID'), id);
  await user.click(screen.getByRole('button', { name: 'Look up voucher' }));
}

describe('PaymentVoucherActions', () => {
  it('renders the lookup field and button, with no status or action controls before a lookup', () => {
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Voucher ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Look up voucher' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve voucher' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post voucher' })).not.toBeInTheDocument();
  });

  it('calls lookupPaymentVoucher with the entered id', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'DRAFT' } });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);

    expect(lookupPaymentVoucherMock).toHaveBeenCalledWith('pv-1');
  });

  it('shows the Approve control (only) for a DRAFT voucher', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'DRAFT' } });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);

    expect(await screen.findByText('DRAFT')).toBeInTheDocument();
    expect(screen.getByText('PV-001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve voucher' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post voucher' })).not.toBeInTheDocument();
  });

  it('shows the Post control (only) for an APPROVED voucher', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'APPROVED' } });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);

    expect(await screen.findByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post voucher' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve voucher' })).not.toBeInTheDocument();
  });

  it('shows no action control for a POSTED voucher, only its status', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'POSTED' } });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);

    expect(await screen.findByText('POSTED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve voucher' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post voucher' })).not.toBeInTheDocument();
  });

  it('shows a not-found message when the lookup succeeds with no voucher', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: true, voucher: null });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);

    expect(await screen.findByText('No payment voucher found with that id.')).toBeInTheDocument();
  });

  it('shows the returned error message when the lookup fails', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: false, error: 'Payment voucher pv-1 not found' });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);

    expect(await screen.findByText('Payment voucher pv-1 not found')).toBeInTheDocument();
  });

  it('approves a DRAFT voucher and re-runs the lookup on success', async () => {
    lookupPaymentVoucherMock
      .mockResolvedValueOnce({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'DRAFT' } })
      .mockResolvedValueOnce({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'APPROVED' } });
    approvePaymentVoucherMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);
    await user.click(await screen.findByRole('button', { name: 'Approve voucher' }));

    expect(approvePaymentVoucherMock).toHaveBeenCalledWith('pv-1');
    expect(lookupPaymentVoucherMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('APPROVED')).toBeInTheDocument();
  });

  it('shows the returned error when approve fails, without re-running the lookup', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'DRAFT' } });
    approvePaymentVoucherMock.mockResolvedValue({ ok: false, error: 'The preparer of a payment voucher cannot also approve it' });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);
    await user.click(await screen.findByRole('button', { name: 'Approve voucher' }));

    expect(await screen.findByText('The preparer of a payment voucher cannot also approve it')).toBeInTheDocument();
    expect(lookupPaymentVoucherMock).toHaveBeenCalledTimes(1);
  });

  it('posts an APPROVED voucher with the selected accounts and re-runs the lookup on success', async () => {
    lookupPaymentVoucherMock
      .mockResolvedValueOnce({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'APPROVED' } })
      .mockResolvedValueOnce({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'POSTED' } });
    postPaymentVoucherMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);
    await user.selectOptions(await screen.findByLabelText('AP control account'), 'acc-1');
    await user.selectOptions(screen.getByLabelText('Cash / bank GL account'), 'acc-1');
    await user.click(screen.getByRole('button', { name: 'Post voucher' }));

    expect(postPaymentVoucherMock).toHaveBeenCalledWith('pv-1', 'acc-1', 'acc-1');
    expect(await screen.findByText('POSTED')).toBeInTheDocument();
  });

  it('blocks posting without both accounts selected', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'APPROVED' } });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);
    await user.click(await screen.findByRole('button', { name: 'Post voucher' }));

    expect(postPaymentVoucherMock).not.toHaveBeenCalled();
    expect(await screen.findByText('Select both an AP control account and a cash GL account first.')).toBeInTheDocument();
  });

  it('clears the voucher and errors when the id field changes', async () => {
    lookupPaymentVoucherMock.mockResolvedValue({ ok: true, voucher: { id: 'pv-1', voucherNumber: 'PV-001', status: 'DRAFT' } });
    const user = userEvent.setup();
    render(<PaymentVoucherActions accountOptions={ACCOUNT_OPTIONS} />);

    await lookUp(user);
    expect(await screen.findByText('DRAFT')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Voucher ID'), '-extra');
    expect(screen.queryByText('DRAFT')).not.toBeInTheDocument();
  });
});
