import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const postARInvoiceMock = vi.fn();
vi.mock('../actions', () => ({
  postARInvoice: (...args: unknown[]) => postARInvoiceMock(...args),
}));

import { PostARInvoiceButton } from '../PostARInvoiceButton';

const ACCOUNT_OPTIONS = [
  { value: 'acc-ar-control', label: '1200 — Accounts Receivable Control' },
  { value: 'acc-other', label: '1300 — Other Receivables' },
];

beforeEach(() => {
  postARInvoiceMock.mockReset();
});

describe('PostARInvoiceButton', () => {
  it('shows a Post button and account select for a DRAFT invoice', () => {
    render(<PostARInvoiceButton id="inv-1" status="DRAFT" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
    expect(screen.getByLabelText('AR control account')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a POSTED invoice', () => {
    render(<PostARInvoiceButton id="inv-1" status="POSTED" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no button, just a dash, for a CANCELLED invoice', () => {
    render(<PostARInvoiceButton id="inv-1" status="CANCELLED" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an inline error and does not call the action when no account is selected', async () => {
    const user = userEvent.setup();
    render(<PostARInvoiceButton id="inv-1" status="DRAFT" accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Select an AR control account first.')).toBeInTheDocument();
    expect(postARInvoiceMock).not.toHaveBeenCalled();
  });

  it('calls postARInvoice with the invoice id and selected account id when clicked', async () => {
    postARInvoiceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PostARInvoiceButton id="inv-42" status="DRAFT" accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('AR control account'), 'acc-ar-control');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(postARInvoiceMock).toHaveBeenCalledWith('inv-42', 'acc-ar-control');
  });

  it('shows the action-returned error message on failure', async () => {
    postARInvoiceMock.mockResolvedValue({ ok: false, error: 'Cannot post an invoice with status POSTED' });
    const user = userEvent.setup();
    render(<PostARInvoiceButton id="inv-42" status="DRAFT" accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('AR control account'), 'acc-ar-control');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Cannot post an invoice with status POSTED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    postARInvoiceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<PostARInvoiceButton id="inv-42" status="DRAFT" accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('AR control account'), 'acc-ar-control');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Failed to post invoice.')).toBeInTheDocument();
  });

  it('disables the Post button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    postARInvoiceMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<PostARInvoiceButton id="inv-42" status="DRAFT" accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('AR control account'), 'acc-ar-control');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('button', { name: 'Posting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Post' })).not.toBeDisabled();
  });
});
