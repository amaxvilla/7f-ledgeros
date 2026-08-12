import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createWorkflowDefinitionMock = vi.fn();
vi.mock('../actions', () => ({
  createWorkflowDefinition: (...args: unknown[]) => createWorkflowDefinitionMock(...args),
}));

import { CreateWorkflowDefinitionForm } from '../CreateWorkflowDefinitionForm';

const ROLE_OPTIONS = [
  { value: 'FINANCE_MANAGER', label: 'FINANCE_MANAGER — Finance Manager' },
  { value: 'CFO', label: 'CFO — Chief Financial Officer' },
];

beforeEach(() => {
  createWorkflowDefinitionMock.mockReset();
});

async function fillHeaderFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Code'), 'PO_APPROVAL');
  await user.type(screen.getByLabelText('Name'), 'Purchase Order Approval');
  await user.type(screen.getByLabelText('Entity type'), 'PurchaseOrder');
}

async function fillStageOne(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText('Sequence (1)'));
  await user.type(screen.getByLabelText('Sequence (1)'), '1');
  await user.type(screen.getByLabelText('Stage name (1)'), 'Manager review');
  await user.selectOptions(screen.getByLabelText('Stage type (1)'), 'REVIEW');
}

describe('CreateWorkflowDefinitionForm', () => {
  it('renders one stage row by default, with a Sequence pre-filled to 1', () => {
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    expect(screen.getByLabelText('Sequence (1)')).toHaveValue(1);
    expect(screen.queryByLabelText('Sequence (2)')).not.toBeInTheDocument();
  });

  it('adds a new stage row with the next sequence number pre-filled', async () => {
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add stage' }));

    expect(screen.getByLabelText('Sequence (2)')).toHaveValue(2);
  });

  it('removes a stage row, but not the last remaining one', async () => {
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add stage' }));
    expect(screen.getByLabelText('Sequence (2)')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.queryByLabelText('Sequence (2)')).not.toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled();
  });

  it('lists every passed-in role option in each stage row', () => {
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'FINANCE_MANAGER — Finance Manager' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CFO — Chief Financial Officer' })).toBeInTheDocument();
  });

  it('disables submission and shows a warning when two stages share a sequence number', async () => {
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add stage' }));
    await user.clear(screen.getByLabelText('Sequence (2)'));
    await user.type(screen.getByLabelText('Sequence (2)'), '1');

    expect(screen.getByText('Stage sequence numbers must be unique.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create workflow definition' })).toBeDisabled();
  });

  it('submits code/name/description/entityType and the stage array, omitting rules entirely', async () => {
    createWorkflowDefinitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await fillHeaderFields(user);
    await fillStageOne(user);
    await user.click(screen.getByRole('button', { name: 'Create workflow definition' }));

    expect(createWorkflowDefinitionMock).toHaveBeenCalledWith({
      code: 'PO_APPROVAL',
      name: 'Purchase Order Approval',
      description: undefined,
      entityType: 'PurchaseOrder',
      stages: [
        {
          sequence: 1,
          name: 'Manager review',
          stageType: 'REVIEW',
          requiredRoleCode: undefined,
          minApprovals: undefined,
        },
      ],
    });
  });

  it('includes requiredRoleCode and minApprovals when filled in', async () => {
    createWorkflowDefinitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await fillHeaderFields(user);
    await fillStageOne(user);
    await user.selectOptions(screen.getByLabelText('Required role (1)'), 'CFO');
    await user.type(screen.getByLabelText('Min approvals (1)'), '2');
    await user.click(screen.getByRole('button', { name: 'Create workflow definition' }));

    expect(createWorkflowDefinitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stages: [expect.objectContaining({ requiredRoleCode: 'CFO', minApprovals: 2 })],
      }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createWorkflowDefinitionMock.mockResolvedValue({ ok: false, error: 'Workflow definition PO_APPROVAL already exists' });
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await fillHeaderFields(user);
    await fillStageOne(user);
    await user.click(screen.getByRole('button', { name: 'Create workflow definition' }));

    expect(await screen.findByText('Workflow definition PO_APPROVAL already exists')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createWorkflowDefinitionMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await fillHeaderFields(user);
    await fillStageOne(user);
    await user.click(screen.getByRole('button', { name: 'Create workflow definition' }));

    expect(await screen.findByText('Failed to create workflow definition.')).toBeInTheDocument();
  });

  it('resets to a single blank stage row after a successful submit', async () => {
    createWorkflowDefinitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await fillHeaderFields(user);
    await fillStageOne(user);
    await user.click(screen.getByRole('button', { name: 'Create workflow definition' }));

    expect(await screen.findByText('Workflow definition created.')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Sequence (1)')).toHaveValue(1);
    expect(screen.queryByLabelText('Sequence (2)')).not.toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createWorkflowDefinitionMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateWorkflowDefinitionForm roleOptions={ROLE_OPTIONS} />);

    await fillHeaderFields(user);
    await fillStageOne(user);
    await user.click(screen.getByRole('button', { name: 'Create workflow definition' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create workflow definition' })).not.toBeDisabled();
  });
});
