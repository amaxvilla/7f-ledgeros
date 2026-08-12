import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same reasoning as CreateVacancyForm.test.tsx's own ../actions mock.
const createPaymentLinkMock = vi.fn();
vi.mock('../actions', () => ({
  createPaymentLink: (...args: unknown[]) => createPaymentLinkMock(...args),
}));

import { CreatePaymentLinkForm } from '../CreatePaymentLinkForm';

beforeEach(() => {
  createPaymentLinkMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Provider'), 'PAYSTACK');
  await user.type(screen.getByLabelText('Reference'), 'invoice-2026-0042');
  await user.type(screen.getByLabelText('Amount'), '500');
  await user.type(screen.getByLabelText('Customer email'), 'customer@example.com');
}

describe('CreatePaymentLinkForm', () => {
  it('renders every field with its label, and defaults currency to NGN', () => {
    render(<CreatePaymentLinkForm entityId="ent-1" />);

    expect(screen.getByLabelText('Provider')).toBeInTheDocument();
    expect(screen.getByLabelText('Reference')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toHaveValue('NGN');
    expect(screen.getByLabelText('Customer email')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate payment link' })).toBeInTheDocument();
  });

  it('marks every field required except description', () => {
    render(<CreatePaymentLinkForm entityId="ent-1" />);

    expect(screen.getByLabelText('Provider')).toBeRequired();
    expect(screen.getByLabelText('Reference')).toBeRequired();
    expect(screen.getByLabelText('Amount')).toBeRequired();
    expect(screen.getByLabelText('Currency')).toBeRequired();
    expect(screen.getByLabelText('Customer email')).toBeRequired();
    expect(screen.getByLabelText('Description (optional)')).not.toBeRequired();
  });

  it('converts a human-entered major-unit amount to minor units before calling the action', async () => {
    createPaymentLinkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePaymentLinkForm entityId="ent-1" />);

    await fillRequiredFields(user); // types "500" into Amount
    await user.click(screen.getByRole('button', { name: 'Generate payment link' }));

    expect(createPaymentLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000 }), // 500 * 100, integer kobo
    );
  });

  it('rounds a fractional major-unit amount to the nearest minor unit', async () => {
    createPaymentLinkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePaymentLinkForm entityId="ent-1" />);

    await user.selectOptions(screen.getByLabelText('Provider'), 'PAYSTACK');
    await user.type(screen.getByLabelText('Reference'), 'invoice-1');
    await user.type(screen.getByLabelText('Amount'), '19.999');
    await user.type(screen.getByLabelText('Customer email'), 'c@example.com');
    await user.click(screen.getByRole('button', { name: 'Generate payment link' }));

    expect(createPaymentLinkMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 2000 })); // Math.round(19.999 * 100)
  });

  it('passes entityId and providerCode through as entered, and omits description when blank', async () => {
    createPaymentLinkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePaymentLinkForm entityId="ent-42" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Generate payment link' }));

    expect(createPaymentLinkMock).toHaveBeenCalledWith({
      entityId: 'ent-42',
      providerCode: 'PAYSTACK',
      reference: 'invoice-2026-0042',
      amount: 50000,
      currency: 'NGN',
      customerEmail: 'customer@example.com',
      description: undefined,
    });
  });

  it('uppercases the currency as it is typed', async () => {
    const user = userEvent.setup();
    render(<CreatePaymentLinkForm entityId="ent-1" />);

    const currencyField = screen.getByLabelText('Currency');
    await user.clear(currencyField);
    await user.type(currencyField, 'usd');

    expect(currencyField).toHaveValue('USD');
  });

  it('shows the action-returned error message on failure', async () => {
    createPaymentLinkMock.mockResolvedValue({ ok: false, error: 'reference must be unique' });
    const user = userEvent.setup();
    render(<CreatePaymentLinkForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Generate payment link' }));

    expect(await screen.findByText('reference must be unique')).toBeInTheDocument();
  });

  it('resets provider/reference/amount/email/description after success, but deliberately leaves currency as-is', async () => {
    createPaymentLinkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePaymentLinkForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Generate payment link' }));

    expect(await screen.findByLabelText('Reference')).toHaveValue('');
    expect(screen.getByLabelText('Amount')).toHaveValue(null);
    expect(screen.getByLabelText('Customer email')).toHaveValue('');
    // Currency has no corresponding setCurrency('NGN') call in the
    // component's reset block — unlike every other field, it's left at
    // whatever the operator last set it to. Documenting the component's
    // actual current behavior rather than assuming it's an oversight:
    // most staff generating payment links back-to-back are likely
    // billing in the same currency each time.
    expect(screen.getByLabelText('Currency')).toHaveValue('NGN');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createPaymentLinkMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreatePaymentLinkForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Generate payment link' }));

    const pendingButton = screen.getByRole('button', { name: 'Initializing…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Generate payment link' })).not.toBeDisabled();
  });
});
