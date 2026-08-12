import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const manualMatchLineMock = vi.fn();
vi.mock('../actions', () => ({
  manualMatchLine: (...args: unknown[]) => manualMatchLineMock(...args),
}));

import { ManualMatchForm } from '../ManualMatchForm';

const STATEMENT_LINE_OPTIONS = [{ value: 'line-1', label: '7/15/2026 — Wire in (1000)' }];
const BOOK_LINE_OPTIONS = [{ value: 'jl-1', label: '7/15/2026 — Dr 1000 / Cr 0' }];

beforeEach(() => {
  manualMatchLineMock.mockReset();
});

describe('ManualMatchForm', () => {
  it('renders every field', () => {
    render(<ManualMatchForm sessionId="sess-1" statementLineOptions={STATEMENT_LINE_OPTIONS} bookLineOptions={BOOK_LINE_OPTIONS} />);

    expect(screen.getByLabelText('Statement line')).toBeInTheDocument();
    expect(screen.getByLabelText('Book (journal) line')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
  });

  it('submits sessionId and the entered values to manualMatchLine', async () => {
    manualMatchLineMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ManualMatchForm sessionId="sess-1" statementLineOptions={STATEMENT_LINE_OPTIONS} bookLineOptions={BOOK_LINE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Statement line'), 'line-1');
    await user.selectOptions(screen.getByLabelText('Book (journal) line'), 'jl-1');
    await user.type(screen.getByLabelText('Notes (optional)'), 'Confirmed via bank portal');
    await user.click(screen.getByRole('button', { name: 'Match' }));

    expect(manualMatchLineMock).toHaveBeenCalledWith('sess-1', {
      bankStatementLineId: 'line-1',
      journalLineId: 'jl-1',
      notes: 'Confirmed via bank portal',
    });
  });

  it('shows an error message when the action fails', async () => {
    manualMatchLineMock.mockResolvedValue({ ok: false, error: 'Statement line already matched.' });
    const user = userEvent.setup();
    render(<ManualMatchForm sessionId="sess-1" statementLineOptions={STATEMENT_LINE_OPTIONS} bookLineOptions={BOOK_LINE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Statement line'), 'line-1');
    await user.selectOptions(screen.getByLabelText('Book (journal) line'), 'jl-1');
    await user.click(screen.getByRole('button', { name: 'Match' }));

    expect(await screen.findByText('Statement line already matched.')).toBeInTheDocument();
  });
});
