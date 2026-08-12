import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const importBankStatementMock = vi.fn();
vi.mock('../actions', () => ({
  importBankStatement: (...args: unknown[]) => importBankStatementMock(...args),
}));

import { ImportStatementForm } from '../ImportStatementForm';

beforeEach(() => {
  importBankStatementMock.mockReset();
});

describe('ImportStatementForm', () => {
  it('renders the header fields and one line by default', () => {
    render(<ImportStatementForm entityId="ent-1" />);

    expect(screen.getByLabelText('Bank account ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Statement date')).toBeInTheDocument();
    expect(screen.getByLabelText('Period start')).toBeInTheDocument();
    expect(screen.getByLabelText('Period end')).toBeInTheDocument();
    expect(screen.getByLabelText('Transaction date (line 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Transaction date (line 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('submits entityId, header fields, and lines to importBankStatement', async () => {
    importBankStatementMock.mockResolvedValue({ ok: true, id: 'stmt-1' });
    const user = userEvent.setup();
    render(<ImportStatementForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Bank account ID'), 'ba-1');
    await user.type(screen.getByLabelText('Statement date'), '2026-07-31');
    await user.type(screen.getByLabelText('Period start'), '2026-07-01');
    await user.type(screen.getByLabelText('Period end'), '2026-07-31');
    await user.clear(screen.getByLabelText('Opening balance'));
    await user.type(screen.getByLabelText('Opening balance'), '1000');
    await user.clear(screen.getByLabelText('Closing balance'));
    await user.type(screen.getByLabelText('Closing balance'), '2000');
    await user.type(screen.getByLabelText('Transaction date (line 1)'), '2026-07-15');
    await user.type(screen.getByLabelText('Description (line 1)'), 'Wire in');
    await user.clear(screen.getByLabelText('Amount (line 1)'));
    await user.type(screen.getByLabelText('Amount (line 1)'), '1000');
    await user.click(screen.getByRole('button', { name: 'Import statement' }));

    expect(importBankStatementMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      bankAccountId: 'ba-1',
      statementDate: '2026-07-31',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      openingBalance: 1000,
      closingBalance: 2000,
      lines: [{ transactionDate: '2026-07-15', description: 'Wire in', reference: undefined, amount: 1000 }],
    });
  });

  it('shows the returned statement ID on success', async () => {
    importBankStatementMock.mockResolvedValue({ ok: true, id: 'stmt-42' });
    const user = userEvent.setup();
    render(<ImportStatementForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Bank account ID'), 'ba-1');
    await user.type(screen.getByLabelText('Statement date'), '2026-07-31');
    await user.type(screen.getByLabelText('Period start'), '2026-07-01');
    await user.type(screen.getByLabelText('Period end'), '2026-07-31');
    await user.type(screen.getByLabelText('Transaction date (line 1)'), '2026-07-15');
    await user.type(screen.getByLabelText('Description (line 1)'), 'Wire in');
    await user.click(screen.getByRole('button', { name: 'Import statement' }));

    expect(await screen.findByText('Imported. Statement ID: stmt-42')).toBeInTheDocument();
  });

  it('shows an error message when the action fails', async () => {
    importBankStatementMock.mockResolvedValue({ ok: false, error: 'A statement needs at least one line' });
    const user = userEvent.setup();
    render(<ImportStatementForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Bank account ID'), 'ba-1');
    await user.type(screen.getByLabelText('Statement date'), '2026-07-31');
    await user.type(screen.getByLabelText('Period start'), '2026-07-01');
    await user.type(screen.getByLabelText('Period end'), '2026-07-31');
    await user.type(screen.getByLabelText('Transaction date (line 1)'), '2026-07-15');
    await user.type(screen.getByLabelText('Description (line 1)'), 'Wire in');
    await user.click(screen.getByRole('button', { name: 'Import statement' }));

    expect(await screen.findByText('A statement needs at least one line')).toBeInTheDocument();
  });
});
