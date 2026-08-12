import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createAPInvoiceMock = vi.fn();
vi.mock('../actions', () => ({
  createAPInvoice: (...args: unknown[]) => createAPInvoiceMock(...args),
}));

import { CreateAPInvoiceForm } from '../CreateAPInvoiceForm';

const VENDOR_OPTIONS = [
  { value: 'ven-1', label: 'V001 — Acme Supplies' },
  { value: 'ven-2', label: 'V002 — Bright Utilities' },
];

const ACCOUNT_OPTIONS = [
  { value: 'acc-1', label: '5000 — Construction Costs' },
  { value: 'acc-2', label: '5100 — Professional Fees' },
];

beforeEach(() => {
  createAPInvoiceMock.mockReset();
});

async function fillHeaderFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Invoice number'), 'INV-2026-001');
  await user.selectOptions(screen.getByLabelText('Vendor'), 'ven-1');
  await user.type(screen.getByLabelText('Invoice date'), '2026-08-01');
}

async function fillLine(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  description: string,
  accountValue: string,
  quantity: string,
  unitCost: string,
) {
  await user.type(screen.getByLabelText(`Description (line ${index})`), description);
  await user.selectOptions(screen.getByLabelText(`Account (line ${index})`), accountValue);
  await user.type(screen.getByLabelText(`Quantity (line ${index})`), quantity);
  await user.type(screen.getByLabelText(`Unit cost (line ${index})`), unitCost);
}

describe('CreateAPInvoiceForm', () => {
  it('renders every header field and a single line by default', () => {
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Invoice number')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice date')).toBeInTheDocument();
    expect(screen.getByLabelText('Due date (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Account (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit cost (line 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Description (line 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeInTheDocument();
  });

  it('populates the vendor and account Selects from their own props', () => {
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'V001 — Acme Supplies' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'V002 — Bright Utilities' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '5000 — Construction Costs' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '5100 — Professional Fees' })).toBeInTheDocument();
  });

  it('marks every field required except Due date', () => {
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Invoice number')).toBeRequired();
    expect(screen.getByLabelText('Vendor')).toBeRequired();
    expect(screen.getByLabelText('Invoice date')).toBeRequired();
    expect(screen.getByLabelText('Due date (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Description (line 1)')).toBeRequired();
    expect(screen.getByLabelText('Account (line 1)')).toBeRequired();
    expect(screen.getByLabelText('Quantity (line 1)')).toBeRequired();
    expect(screen.getByLabelText('Unit cost (line 1)')).toBeRequired();
  });

  it('adds a new, independently-fillable line when "+ Add line" is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add line' }));

    expect(screen.getByLabelText('Description (line 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Account (line 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity (line 2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit cost (line 2)')).toBeInTheDocument();
  });

  it('removes a line when its own Remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    expect(screen.getByLabelText('Description (line 2)')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[1]);

    expect(screen.queryByLabelText('Description (line 2)')).not.toBeInTheDocument();
  });

  it('disables the only remaining line\'s Remove button — an invoice always needs at least one line', () => {
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('submits a single-line payload with numeric quantity/unitCost and no dueDate', async () => {
    createAPInvoiceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Office rent', 'acc-1', '1', '500000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(createAPInvoiceMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      invoiceNumber: 'INV-2026-001',
      vendorId: 'ven-1',
      invoiceDate: '2026-08-01',
      dueDate: undefined,
      lines: [{ description: 'Office rent', accountId: 'acc-1', quantity: 1, unitCost: 500000 }],
    });
  });

  it('submits every added line, in order, plus dueDate when filled in', async () => {
    createAPInvoiceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-09-01');
    await fillLine(user, 1, 'Office rent', 'acc-1', '1', '500000');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, 'Cleaning services', 'acc-2', '2', '15000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(createAPInvoiceMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      invoiceNumber: 'INV-2026-001',
      vendorId: 'ven-1',
      invoiceDate: '2026-08-01',
      dueDate: '2026-09-01',
      lines: [
        { description: 'Office rent', accountId: 'acc-1', quantity: 1, unitCost: 500000 },
        { description: 'Cleaning services', accountId: 'acc-2', quantity: 2, unitCost: 15000 },
      ],
    });
  });

  it('shows the action-returned error message on failure', async () => {
    createAPInvoiceMock.mockResolvedValue({ ok: false, error: 'Invoice INV-2026-001 already exists for this vendor' });
    const user = userEvent.setup();
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Office rent', 'acc-1', '1', '500000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText('Invoice INV-2026-001 already exists for this vendor')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createAPInvoiceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Office rent', 'acc-1', '1', '500000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText('Failed to create invoice.')).toBeInTheDocument();
  });

  it('resets header fields and collapses back to a single blank line after a successful submit', async () => {
    createAPInvoiceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Office rent', 'acc-1', '1', '500000');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, 'Cleaning services', 'acc-2', '2', '15000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByLabelText('Invoice number')).toHaveValue('');
    expect(screen.getByLabelText('Vendor')).toHaveValue('');
    expect(screen.getByLabelText('Invoice date')).toHaveValue('');
    expect(screen.queryByLabelText('Description (line 2)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Description (line 1)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createAPInvoiceMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateAPInvoiceForm entityId="ent-1" vendorOptions={VENDOR_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'Office rent', 'acc-1', '1', '500000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    const pendingButton = screen.getByRole('button', { name: 'Creating…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create invoice' })).not.toBeDisabled();
  });
});
