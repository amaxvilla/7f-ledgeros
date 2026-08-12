import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createReconciliationSessionMock = vi.fn();
vi.mock('../actions', () => ({
  createReconciliationSession: (...args: unknown[]) => createReconciliationSessionMock(...args),
}));

import { CreateSessionForm } from '../CreateSessionForm';

const ACCOUNT_OPTIONS = [{ value: 'acct-1', label: '1000-100 — Cash at bank' }];

beforeEach(() => {
  createReconciliationSessionMock.mockReset();
});

describe('CreateSessionForm', () => {
  it('renders every field', () => {
    render(<CreateSessionForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    expect(screen.getByLabelText('Bank account ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Statement ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Bank GL account')).toBeInTheDocument();
    expect(screen.getByLabelText('Session date')).toBeInTheDocument();
  });

  it('submits entityId and the entered values to createReconciliationSession', async () => {
    createReconciliationSessionMock.mockResolvedValue({ ok: true, id: 'sess-1' });
    const user = userEvent.setup();
    render(<CreateSessionForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Bank account ID'), 'ba-1');
    await user.type(screen.getByLabelText('Statement ID'), 'stmt-1');
    await user.selectOptions(screen.getByLabelText('Bank GL account'), 'acct-1');
    await user.type(screen.getByLabelText('Session date'), '2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Create session' }));

    expect(createReconciliationSessionMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      bankAccountId: 'ba-1',
      statementId: 'stmt-1',
      bankGlAccountId: 'acct-1',
      sessionDate: '2026-08-01',
    });
  });

  it('shows the returned session ID on success', async () => {
    createReconciliationSessionMock.mockResolvedValue({ ok: true, id: 'sess-42' });
    const user = userEvent.setup();
    render(<CreateSessionForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Bank account ID'), 'ba-1');
    await user.type(screen.getByLabelText('Statement ID'), 'stmt-1');
    await user.selectOptions(screen.getByLabelText('Bank GL account'), 'acct-1');
    await user.type(screen.getByLabelText('Session date'), '2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Create session' }));

    expect(await screen.findByText('Session created. Session ID: sess-42')).toBeInTheDocument();
  });

  it('shows an error message when the action fails', async () => {
    createReconciliationSessionMock.mockResolvedValue({ ok: false, error: 'Statement not found.' });
    const user = userEvent.setup();
    render(<CreateSessionForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} />);

    await user.type(screen.getByLabelText('Bank account ID'), 'ba-1');
    await user.type(screen.getByLabelText('Statement ID'), 'stmt-1');
    await user.selectOptions(screen.getByLabelText('Bank GL account'), 'acct-1');
    await user.type(screen.getByLabelText('Session date'), '2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Create session' }));

    expect(await screen.findByText('Statement not found.')).toBeInTheDocument();
  });
});
