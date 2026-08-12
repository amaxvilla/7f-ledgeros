import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const recordAdjustmentMock = vi.fn();
vi.mock('../actions', () => ({
  recordAdjustment: (...args: unknown[]) => recordAdjustmentMock(...args),
}));

import { RecordAdjustmentForm } from '../RecordAdjustmentForm';

const STATEMENT_LINE_OPTIONS = [{ value: 'line-1', label: '7/15/2026 — Bank charge (-25)' }];
const ACCOUNT_OPTIONS = [{ value: 'acct-1', label: '6100-100 — Bank charges' }];

beforeEach(() => {
  recordAdjustmentMock.mockReset();
});

describe('RecordAdjustmentForm', () => {
  it('renders every field', () => {
    render(<RecordAdjustmentForm sessionId="sess-1" statementLineOptions={STATEMENT_LINE_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Statement line')).toBeInTheDocument();
    expect(screen.getByLabelText('Adjustment type')).toBeInTheDocument();
    expect(screen.getByLabelText('Contra GL account')).toBeInTheDocument();
  });

  it('submits sessionId and the entered values to recordAdjustment', async () => {
    recordAdjustmentMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordAdjustmentForm sessionId="sess-1" statementLineOptions={STATEMENT_LINE_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Statement line'), 'line-1');
    await user.selectOptions(screen.getByLabelText('Adjustment type'), 'BANK_CHARGE');
    await user.selectOptions(screen.getByLabelText('Contra GL account'), 'acct-1');
    await user.click(screen.getByRole('button', { name: 'Record adjustment' }));

    expect(recordAdjustmentMock).toHaveBeenCalledWith('sess-1', {
      bankStatementLineId: 'line-1',
      adjustmentType: 'BANK_CHARGE',
      contraAccountId: 'acct-1',
    });
  });

  it('shows an error message when the action fails', async () => {
    recordAdjustmentMock.mockResolvedValue({ ok: false, error: 'Statement line already matched.' });
    const user = userEvent.setup();
    render(<RecordAdjustmentForm sessionId="sess-1" statementLineOptions={STATEMENT_LINE_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Statement line'), 'line-1');
    await user.selectOptions(screen.getByLabelText('Adjustment type'), 'BANK_CHARGE');
    await user.selectOptions(screen.getByLabelText('Contra GL account'), 'acct-1');
    await user.click(screen.getByRole('button', { name: 'Record adjustment' }));

    expect(await screen.findByText('Statement line already matched.')).toBeInTheDocument();
  });
});
