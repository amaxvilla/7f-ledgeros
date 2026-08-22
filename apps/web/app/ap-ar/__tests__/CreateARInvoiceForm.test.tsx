import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createARInvoiceMock = vi.fn();
vi.mock('../actions', () => ({
  createARInvoice: (...args: unknown[]) => createARInvoiceMock(...args),
}));

import { CreateARInvoiceForm } from '../CreateARInvoiceForm';

const CUSTOMER_OPTIONS = [
  { value: 'cus-1', label: 'C001 — Northgate Estates' },
  { value: 'cus-2', label: 'C002 — Lakeside Holdings' },
];

const ACCOUNT_OPTIONS = [
  { value: 'acc-1', label: '4000 — Unit Sales' },
  { value: 'acc-2', label: '4100 — Service Charge Income' },
];

beforeEach(() => {
  createARInvoiceMock.mockReset();
});

async function fillHeaderFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Invoice number'), 'INV-2026-001');
  await user.selectOptions(screen.getByLabelText('Customer'), 'cus-1');
  await user.type(screen.getByLabelText('Invoice date'), '2026-08-01');
}

async function fillLine(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  description: string,
  accountValue: string,
  quantity: string,
  unitPrice: string,
) {
  await user.type(screen.getByLabelText(`Description (line ${index})`), description);
  await user.selectOptions(screen.getByLabelText(`Account (line ${index})`), accountValue);
  await user.type(screen.getByLabelText(`Quantity (line ${index})`), quantity);
  await user.type(screen.getByLabelText(`Unit price (line ${index})`), unitPrice);
}

describe('CreateARInvoiceForm', () => {
  it('renders every header field and a single line by default', () => {
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Invoice number')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice date')).toBeInTheDocument();
    expect(screen.getByLabelText('Due date (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Account (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit price (line 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Description (line 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeInTheDocument();
  });

  it('populates the customer and account Selects from their own props', () => {
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'C001 — Northgate Estates' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'C002 — Lakeside Holdings' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '4000 — Unit Sales' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '4100 — Service Charge Income' })).toBeInTheDocument();
  });

  it('marks every field required except Due date', () => {
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Invoice number')).toBeRequired();
    expect(screen.getByLabelText('Customer')).toBeRequired();
    expect(screen.getByLabelText('Invoice date')).toBeRequired();
    expect(screen.getByLabelText('Due date (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Description (line 1)')).toBeRequired();
    expect(screen.getByLabelText('Account (line 1)')).toBeRequired();
    expect(screen.getByLabelText('Quantity (line 1)')).toBeRequired();
    expect(screen.getByLabelText('Unit price (line 1)')).toBeRequired();
  });

  it('adds a new, independently-fillable line when "+ Add line" is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add line' }));

    expect(screen.getByLabelText('Description (line 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Account (line 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity (line 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit price (line 2)')).toBeInTheDocument();
  });

  it('removes a line when its own Remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    expect(screen.getByLabelText('Description (line 2)')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[1]);

    expect(screen.queryByLabelText('Description (line 2)')).not.toBeInTheDocument();
  });

  it('disables the only remaining line\'s Remove button — an invoice always needs at least one line', () => {
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('submits a single-line payload with numeric quantity/unitPrice and no dueDate', async () => {
    createARInvoiceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Unit A12 sale', 'acc-1', '1', '25000000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(createARInvoiceMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      invoiceNumber: 'INV-2026-001',
      customerId: 'cus-1',
      invoiceDate: '2026-08-01',
      dueDate: undefined,
      lines: [{ description: 'Unit A12 sale', accountId: 'acc-1', quantity: 1, unitPrice: 25000000 }],
    });
  });

  it('submits every added line, in order, plus dueDate when filled in', async () => {
    createARInvoiceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-09-01');
    await fillLine(user, 1, 'Unit A12 sale', 'acc-1', '1', '25000000');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, 'Service charge Q3', 'acc-2', '1', '150000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(createARInvoiceMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      invoiceNumber: 'INV-2026-001',
      customerId: 'cus-1',
      invoiceDate: '2026-08-01',
      dueDate: '2026-09-01',
      lines: [
        { description: 'Unit A12 sale', accountId: 'acc-1', quantity: 1, unitPrice: 25000000 },
        { description: 'Service charge Q3', accountId: 'acc-2', quantity: 1, unitPrice: 150000 },
      ],
    });
  }, 15000);

  it('shows the action-returned error message on failure', async () => {
    createARInvoiceMock.mockResolvedValue({ ok: false, error: 'Invoice INV-2026-001 already exists for this customer' });
    const user = userEvent.setup();
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Unit A12 sale', 'acc-1', '1', '25000000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText('Invoice INV-2026-001 already exists for this customer')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createARInvoiceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Unit A12 sale', 'acc-1', '1', '25000000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText('Failed to create invoice.')).toBeInTheDocument();
  });

  it('resets header fields and collapses back to a single blank line after a successful submit', async () => {
    createARInvoiceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Unit A12 sale', 'acc-1', '1', '25000000');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, 'Service charge Q3', 'acc-2', '1', '150000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByLabelText('Invoice number')).toHaveValue('');
    expect(screen.getByLabelText('Customer')).toHaveValue('');
    expect(screen.getByLabelText('Invoice date')).toHaveValue('');
    expect(screen.queryByLabelText('Description (line 2)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Description (line 1)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createARInvoiceMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateARInvoiceForm entityId="ent-1" customerOptions={CUSTOMER_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Unit A12 sale', 'acc-1', '1', '25000000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    const pendingButton = screen.getByRole('button', { name: 'Creating…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create invoice' })).not.toBeDisabled();
  });
});
