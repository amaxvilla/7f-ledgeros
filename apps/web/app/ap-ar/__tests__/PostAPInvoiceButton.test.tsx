import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const postAPInvoiceMock = vi.fn();
vi.mock('../actions', () => ({
  postAPInvoice: (...args: unknown[]) => postAPInvoiceMock(...args),
}));

import { PostAPInvoiceButton } from '../PostAPInvoiceButton';

const ACCOUNT_OPTIONS = [
  { value: 'acc-ap-control', label: '2100 — Accounts Payable Control' },
  { value: 'acc-other', label: '2200 — Other Payables' },
];

beforeEach(() => {
  postAPInvoiceMock.mockReset();
});

describe('PostAPInvoiceButton', () => {
  it('shows a Post button and account select for a DRAFT, non-PO invoice', () => {
    render(<PostAPInvoiceButton id="inv-1" status="DRAFT" purchaseOrderId={null} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
    expect(screen.getByLabelText('AP control account')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a POSTED invoice', () => {
    render(<PostAPInvoiceButton id="inv-1" status="POSTED" purchaseOrderId={null} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a CANCELLED invoice', () => {
    render(<PostAPInvoiceButton id="inv-1" status="CANCELLED" purchaseOrderId={null} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a DRAFT invoice that is PO-backed', () => {
    render(<PostAPInvoiceButton id="inv-1" status="DRAFT" purchaseOrderId="po-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an inline error and does not call the action when no account is selected', async () => {
    const user = userEvent.setup();
    render(<PostAPInvoiceButton id="inv-1" status="DRAFT" purchaseOrderId={null} accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Select an AP control account first.')).toBeInTheDocument();
    expect(postAPInvoiceMock).not.toHaveBeenCalled();
  });

  it('calls postAPInvoice with the invoice id and selected account id when clicked', async () => {
    postAPInvoiceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PostAPInvoiceButton id="inv-42" status="DRAFT" purchaseOrderId={null} accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('AP control account'), 'acc-ap-control');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(postAPInvoiceMock).toHaveBeenCalledWith('inv-42', 'acc-ap-control');
  });

  it('shows the action-returned error message on failure', async () => {
    postAPInvoiceMock.mockResolvedValue({ ok: false, error: 'Cannot post an invoice with status POSTED' });
    const user = userEvent.setup();
    render(<PostAPInvoiceButton id="inv-42" status="DRAFT" purchaseOrderId={null} accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('AP control account'), 'acc-ap-control');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Cannot post an invoice with status POSTED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    postAPInvoiceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<PostAPInvoiceButton id="inv-42" status="DRAFT" purchaseOrderId={null} accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('AP control account'), 'acc-ap-control');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Failed to post invoice.')).toBeInTheDocument();
  });

  it('disables the Post button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    postAPInvoiceMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<PostAPInvoiceButton id="inv-42" status="DRAFT" purchaseOrderId={null} accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('AP control account'), 'acc-ap-control');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('button', { name: 'Posting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Post' })).not.toBeDisabled();
  });
});
