import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createAssignmentMock = vi.fn();
vi.mock('../actions', () => ({
  createAssignment: (...args: unknown[]) => createAssignmentMock(...args),
}));

import { CreateAssignmentForm } from '../CreateAssignmentForm';

const AGENTS = [{ id: 'agent-1', code: 'AG-001', displayName: 'Jane Doe Realty' }];
const PROJECTS = [{ id: 'proj-1', code: 'PRJ-001', name: 'Lekki Gardens Phase 1' }];

beforeEach(() => {
  createAssignmentMock.mockReset();
});

describe('CreateAssignmentForm', () => {
  it('defaults to a PROJECT target and shows a Project select', () => {
    render(<CreateAssignmentForm entityId="ent-1" agentOptions={AGENTS} projectOptions={PROJECTS} />);

    expect(screen.getByLabelText('Agent')).toBeInTheDocument();
    expect(screen.getByLabelText('Target type')).toHaveValue('PROJECT');
    expect(screen.getByLabelText('Project')).toBeInTheDocument();
    expect(screen.queryByLabelText('Unit ID')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sale (allocation) ID')).not.toBeInTheDocument();
  });

  it('switches to a Unit ID text field when target type is UNIT', async () => {
    const user = userEvent.setup();
    render(<CreateAssignmentForm entityId="ent-1" agentOptions={AGENTS} projectOptions={PROJECTS} />);

    await user.selectOptions(screen.getByLabelText('Target type'), 'UNIT');

    expect(screen.getByLabelText('Unit ID')).toBeInTheDocument();
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument();
  });

  it('blocks submit without an agent selected', async () => {
    const user = userEvent.setup();
    render(<CreateAssignmentForm entityId="ent-1" agentOptions={AGENTS} projectOptions={PROJECTS} />);

    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));

    expect(screen.getByText('Select an agent.')).toBeInTheDocument();
    expect(createAssignmentMock).not.toHaveBeenCalled();
  });

  it('submits with entityId and the resolved target field for the selected scope', async () => {
    createAssignmentMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateAssignmentForm entityId="ent-1" agentOptions={AGENTS} projectOptions={PROJECTS} />);

    await user.selectOptions(screen.getByLabelText('Agent'), 'agent-1');
    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
    await user.selectOptions(screen.getByLabelText('Role'), 'CO_AGENT');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));

    expect(createAssignmentMock).toHaveBeenCalledWith({
      agentId: 'agent-1',
      entityId: 'ent-1',
      scope: 'PROJECT',
      role: 'CO_AGENT',
      projectId: 'proj-1',
      unitId: undefined,
      allocationId: undefined,
      notes: undefined,
    });
  });

  it('surfaces a server-side error rather than clearing the form', async () => {
    createAssignmentMock.mockResolvedValue({ ok: false, error: 'This project already has an active PRIMARY agent assignment' });
    const user = userEvent.setup();
    render(<CreateAssignmentForm entityId="ent-1" agentOptions={AGENTS} projectOptions={PROJECTS} />);

    await user.selectOptions(screen.getByLabelText('Agent'), 'agent-1');
    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));

    expect(await screen.findByText('This project already has an active PRIMARY agent assignment')).toBeInTheDocument();
    expect(screen.getByLabelText('Agent')).toHaveValue('agent-1');
  });
});
