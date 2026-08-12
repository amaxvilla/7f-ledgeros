import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const recordCustomerPaymentMock = vi.fn();
vi.mock('../actions', () => ({
  recordCustomerPayment: (...args: unknown[]) => recordCustomerPaymentMock(...args),
}));

import { RecordCustomerPaymentForm } from '../RecordCustomerPaymentForm';

const ACCOUNT_OPTIONS = [
  { value: 'acct-bank', label: '1000-100 — Cash at bank' },
  { value: 'acct-deferred', label: '2200-100 — Deferred revenue' },
];

beforeEach(() => {
  recordCustomerPaymentMock.mockReset();
});

describe('RecordCustomerPaymentForm', () => {
  it('renders every field with no entityId field at all', () => {
    render(<RecordCustomerPaymentForm accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Installment line ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Entry date')).toBeInTheDocument();
    expect(screen.getByLabelText('Bank/cash GL account')).toBeInTheDocument();
    expect(screen.getByLabelText('Deferred revenue GL account')).toBeInTheDocument();
    expect(screen.queryByLabelText(/entity/i)).not.toBeInTheDocument();
  });

  it('submits the entered values to recordCustomerPayment', async () => {
    recordCustomerPaymentMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordCustomerPaymentForm accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Installment line ID'), 'il-1');
    await user.type(screen.getByLabelText('Amount'), '15000');
    await user.type(screen.getByLabelText('Entry date'), '2026-08-01');
    await user.selectOptions(screen.getByLabelText('Bank/cash GL account'), 'acct-bank');
    await user.selectOptions(screen.getByLabelText('Deferred revenue GL account'), 'acct-deferred');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    expect(recordCustomerPaymentMock).toHaveBeenCalledWith({
      installmentLineId: 'il-1',
      amount: 15000,
      entryDate: '2026-08-01',
      bankAccountGlId: 'acct-bank',
      deferredRevenueGlId: 'acct-deferred',
    });
  });

  it('shows a success message after a successful submission', async () => {
    recordCustomerPaymentMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordCustomerPaymentForm accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Installment line ID'), 'il-1');
    await user.type(screen.getByLabelText('Amount'), '15000');
    await user.type(screen.getByLabelText('Entry date'), '2026-08-01');
    await user.selectOptions(screen.getByLabelText('Bank/cash GL account'), 'acct-bank');
    await user.selectOptions(screen.getByLabelText('Deferred revenue GL account'), 'acct-deferred');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    expect(await screen.findByText('Payment recorded and posted to deferred revenue.')).toBeInTheDocument();
  });

  it('shows an error message when the action fails', async () => {
    recordCustomerPaymentMock.mockResolvedValue({ ok: false, error: 'Installment line not found.' });
    const user = userEvent.setup();
    render(<RecordCustomerPaymentForm accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Installment line ID'), 'il-1');
    await user.type(screen.getByLabelText('Amount'), '15000');
    await user.type(screen.getByLabelText('Entry date'), '2026-08-01');
    await user.selectOptions(screen.getByLabelText('Bank/cash GL account'), 'acct-bank');
    await user.selectOptions(screen.getByLabelText('Deferred revenue GL account'), 'acct-deferred');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    expect(await screen.findByText('Installment line not found.')).toBeInTheDocument();
  });
});
