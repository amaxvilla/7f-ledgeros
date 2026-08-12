import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createJournalEntryMock = vi.fn();
vi.mock('../actions', () => ({
  createJournalEntry: (...args: unknown[]) => createJournalEntryMock(...args),
}));

import { CreateJournalEntryForm } from '../CreateJournalEntryForm';

const ACCOUNT_OPTIONS = [
  { value: 'acct-1', label: '1000-100 — Cash at bank' },
  { value: 'acct-2', label: '4000-100 — Sales revenue' },
];

beforeEach(() => {
  createJournalEntryMock.mockReset();
});

describe('CreateJournalEntryForm', () => {
  it('renders the header fields and two lines by default', () => {
    render(<CreateJournalEntryForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Entry date')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Account (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Account (line 2)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Account (line 3)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create journal entry' })).toBeInTheDocument();
  });

  it('disables "Remove" when only two lines remain', () => {
    render(<CreateJournalEntryForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).toBeDisabled();
  });

  it('adds a third line when "+ Add line" is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateJournalEntryForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add line' }));

    expect(screen.getByLabelText('Account (line 3)')).toBeInTheDocument();
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    expect(removeButtons[0]).not.toBeDisabled();
  });

  it('submits entityId, header fields, and lines to createJournalEntry', async () => {
    createJournalEntryMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateJournalEntryForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Entry date'), '2026-08-01');
    await user.type(screen.getByLabelText('Description'), 'Opening balance');
    await user.selectOptions(screen.getByLabelText('Account (line 1)'), 'acct-1');
    await user.clear(screen.getByLabelText('Debit (line 1)'));
    await user.type(screen.getByLabelText('Debit (line 1)'), '1000');
    await user.selectOptions(screen.getByLabelText('Account (line 2)'), 'acct-2');
    await user.clear(screen.getByLabelText('Credit (line 2)'));
    await user.type(screen.getByLabelText('Credit (line 2)'), '1000');
    await user.click(screen.getByRole('button', { name: 'Create journal entry' }));

    expect(createJournalEntryMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      entryDate: '2026-08-01',
      description: 'Opening balance',
      lines: [
        { accountId: 'acct-1', debit: 1000, credit: 0, memo: undefined },
        { accountId: 'acct-2', debit: 0, credit: 1000, memo: undefined },
      ],
    });
  });

  it('shows an error message when the action fails', async () => {
    createJournalEntryMock.mockResolvedValue({ ok: false, error: 'Journal entry lines must balance.' });
    const user = userEvent.setup();
    render(<CreateJournalEntryForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Entry date'), '2026-08-01');
    await user.type(screen.getByLabelText('Description'), 'Opening balance');
    await user.selectOptions(screen.getByLabelText('Account (line 1)'), 'acct-1');
    await user.selectOptions(screen.getByLabelText('Account (line 2)'), 'acct-2');
    await user.click(screen.getByRole('button', { name: 'Create journal entry' }));

    expect(await screen.findByText('Journal entry lines must balance.')).toBeInTheDocument();
  });
});
