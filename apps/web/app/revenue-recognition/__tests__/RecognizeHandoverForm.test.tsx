import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const recognizeHandoverRevenueMock = vi.fn();
vi.mock('../actions', () => ({
  recognizeHandoverRevenue: (...args: unknown[]) => recognizeHandoverRevenueMock(...args),
}));

import { RecognizeHandoverForm } from '../RecognizeHandoverForm';

const ACCOUNT_OPTIONS = [
  { value: 'acct-deferred', label: '2200-100 — Deferred revenue' },
  { value: 'acct-sales', label: '4100-100 — Property sales revenue' },
  { value: 'acct-cogs', label: '5100-100 — Cost of sales' },
  { value: 'acct-inventory', label: '1300-100 — Property inventory' },
];

beforeEach(() => {
  recognizeHandoverRevenueMock.mockReset();
});

describe('RecognizeHandoverForm', () => {
  it('renders every field', () => {
    render(<RecognizeHandoverForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Unit ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Entry date')).toBeInTheDocument();
    expect(screen.getByLabelText('Sale price')).toBeInTheDocument();
    expect(screen.getByLabelText('Cost of unit')).toBeInTheDocument();
    expect(screen.getByLabelText('Deferred revenue GL account')).toBeInTheDocument();
    expect(screen.getByLabelText('Property sales revenue GL account')).toBeInTheDocument();
    expect(screen.getByLabelText('Cost of sales GL account')).toBeInTheDocument();
    expect(screen.getByLabelText('Property inventory GL account')).toBeInTheDocument();
  });

  it('submits entityId and the entered values to recognizeHandoverRevenue', async () => {
    recognizeHandoverRevenueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecognizeHandoverForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Unit ID'), 'unit-1');
    await user.type(screen.getByLabelText('Entry date'), '2026-08-01');
    await user.type(screen.getByLabelText('Sale price'), '250000');
    await user.type(screen.getByLabelText('Cost of unit'), '180000');
    await user.selectOptions(screen.getByLabelText('Deferred revenue GL account'), 'acct-deferred');
    await user.selectOptions(screen.getByLabelText('Property sales revenue GL account'), 'acct-sales');
    await user.selectOptions(screen.getByLabelText('Cost of sales GL account'), 'acct-cogs');
    await user.selectOptions(screen.getByLabelText('Property inventory GL account'), 'acct-inventory');
    await user.click(screen.getByRole('button', { name: 'Recognize handover revenue' }));

    expect(recognizeHandoverRevenueMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      unitId: 'unit-1',
      entryDate: '2026-08-01',
      salePrice: 250000,
      costOfUnit: 180000,
      deferredRevenueGlId: 'acct-deferred',
      propertySalesRevenueGlId: 'acct-sales',
      costOfSalesGlId: 'acct-cogs',
      propertyInventoryGlId: 'acct-inventory',
    });
  });

  it('shows a success message after a successful submission', async () => {
    recognizeHandoverRevenueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecognizeHandoverForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Unit ID'), 'unit-1');
    await user.type(screen.getByLabelText('Entry date'), '2026-08-01');
    await user.type(screen.getByLabelText('Sale price'), '250000');
    await user.type(screen.getByLabelText('Cost of unit'), '180000');
    await user.selectOptions(screen.getByLabelText('Deferred revenue GL account'), 'acct-deferred');
    await user.selectOptions(screen.getByLabelText('Property sales revenue GL account'), 'acct-sales');
    await user.selectOptions(screen.getByLabelText('Cost of sales GL account'), 'acct-cogs');
    await user.selectOptions(screen.getByLabelText('Property inventory GL account'), 'acct-inventory');
    await user.click(screen.getByRole('button', { name: 'Recognize handover revenue' }));

    expect(await screen.findByText('Revenue recognized on handover.')).toBeInTheDocument();
  });

  it('shows an error message when the action fails', async () => {
    recognizeHandoverRevenueMock.mockResolvedValue({ ok: false, error: 'Unit not found.' });
    const user = userEvent.setup();
    render(<RecognizeHandoverForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Unit ID'), 'unit-1');
    await user.type(screen.getByLabelText('Entry date'), '2026-08-01');
    await user.type(screen.getByLabelText('Sale price'), '250000');
    await user.type(screen.getByLabelText('Cost of unit'), '180000');
    await user.selectOptions(screen.getByLabelText('Deferred revenue GL account'), 'acct-deferred');
    await user.selectOptions(screen.getByLabelText('Property sales revenue GL account'), 'acct-sales');
    await user.selectOptions(screen.getByLabelText('Cost of sales GL account'), 'acct-cogs');
    await user.selectOptions(screen.getByLabelText('Property inventory GL account'), 'acct-inventory');
    await user.click(screen.getByRole('button', { name: 'Recognize handover revenue' }));

    expect(await screen.findByText('Unit not found.')).toBeInTheDocument();
  });
});
