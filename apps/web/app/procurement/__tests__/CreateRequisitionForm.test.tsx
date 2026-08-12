import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createRequisitionMock = vi.fn();
vi.mock('../actions', () => ({
  createRequisition: (...args: unknown[]) => createRequisitionMock(...args),
}));

import { CreateRequisitionForm } from '../CreateRequisitionForm';

const ACCOUNT_OPTIONS = [{ value: 'acct-1', label: '5000-100 — Office supplies' }];
const PROJECT_OPTIONS = [{ value: 'proj-1', label: 'PRJ-001 — Riverside Towers' }];

beforeEach(() => {
  createRequisitionMock.mockReset();
});

describe('CreateRequisitionForm', () => {
  it('renders the header fields and one line by default', () => {
    render(<CreateRequisitionForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('PR number')).toBeInTheDocument();
    expect(screen.getByLabelText('Project (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Justification (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (line 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Description (line 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('adds a second line when "+ Add line" is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} projectOptions={PROJECT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add line' }));

    expect(screen.getByLabelText('Description (line 2)')).toBeInTheDocument();
  });

  it('submits entityId, header fields, and lines to createRequisition', async () => {
    createRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} projectOptions={PROJECT_OPTIONS} />);

    await user.type(screen.getByLabelText('PR number'), 'PR-001');
    await user.type(screen.getByLabelText('Description (line 1)'), 'Printer paper');
    await user.selectOptions(screen.getByLabelText('Account (line 1)'), 'acct-1');
    await user.clear(screen.getByLabelText('Quantity (line 1)'));
    await user.type(screen.getByLabelText('Quantity (line 1)'), '10');
    await user.clear(screen.getByLabelText('Est. unit cost (line 1)'));
    await user.type(screen.getByLabelText('Est. unit cost (line 1)'), '5');
    await user.click(screen.getByRole('button', { name: 'Create requisition' }));

    expect(createRequisitionMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      prNumber: 'PR-001',
      projectId: undefined,
      justification: undefined,
      lines: [{ description: 'Printer paper', accountId: 'acct-1', quantity: 10, estimatedUnitCost: 5 }],
    });
  });

  it('shows an error message when the action fails', async () => {
    createRequisitionMock.mockResolvedValue({ ok: false, error: 'Requisition number already exists.' });
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" accountOptions={ACCOUNT_OPTIONS} projectOptions={PROJECT_OPTIONS} />);

    await user.type(screen.getByLabelText('PR number'), 'PR-001');
    await user.type(screen.getByLabelText('Description (line 1)'), 'Printer paper');
    await user.selectOptions(screen.getByLabelText('Account (line 1)'), 'acct-1');
    await user.click(screen.getByRole('button', { name: 'Create requisition' }));

    expect(await screen.findByText('Requisition number already exists.')).toBeInTheDocument();
  });
});
