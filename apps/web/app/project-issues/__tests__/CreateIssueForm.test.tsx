import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createIssueMock = vi.fn();
vi.mock('../actions', () => ({
  createIssue: (...args: unknown[]) => createIssueMock(...args),
}));

import { CreateIssueForm } from '../CreateIssueForm';

const PROJECT_OPTIONS = [
  { value: 'proj-1', label: 'PRJ-001 — The Shore' },
  { value: 'proj-2', label: 'PRJ-002 — The Cove' },
];

beforeEach(() => {
  createIssueMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
  await user.type(screen.getByLabelText('Title'), 'Site access blocked by neighboring plot dispute');
}

describe('CreateIssueForm', () => {
  it('renders every field with its label', () => {
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Assigned to (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Due date (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log issue' })).toBeInTheDocument();
  });

  it('populates the Project Select from the projectOptions prop', () => {
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'PRJ-001 — The Shore' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PRJ-002 — The Cove' })).toBeInTheDocument();
  });

  it('lists all four IssuePriority options, including Critical', () => {
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'Low' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Critical' })).toBeInTheDocument();
  });

  it('marks Project and Title as required, and every other field optional', () => {
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project')).toBeRequired();
    expect(screen.getByLabelText('Title')).toBeRequired();
    expect(screen.getByLabelText('Priority')).not.toBeRequired();
    expect(screen.getByLabelText('Assigned to (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Due date (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Description (optional)')).not.toBeRequired();
  });

  it('submits with optional fields, including priority, as undefined when left blank', async () => {
    createIssueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log issue' }));

    expect(createIssueMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      projectId: 'proj-1',
      title: 'Site access blocked by neighboring plot dispute',
      description: undefined,
      priority: undefined,
      assignedToId: undefined,
      dueDate: undefined,
    });
  });

  it('includes optional fields, including the selected priority, when filled in', async () => {
    createIssueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText('Priority'), 'CRITICAL');
    await user.type(screen.getByLabelText('Assigned to (optional)'), 'user-9');
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-09-01');
    await user.type(screen.getByLabelText('Description (optional)'), 'Blocking Phase 2 groundwork');
    await user.click(screen.getByRole('button', { name: 'Log issue' }));

    expect(createIssueMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      projectId: 'proj-1',
      title: 'Site access blocked by neighboring plot dispute',
      description: 'Blocking Phase 2 groundwork',
      priority: 'CRITICAL',
      assignedToId: 'user-9',
      dueDate: '2026-09-01',
    });
  });

  it('shows the action-returned error message on failure', async () => {
    createIssueMock.mockResolvedValue({ ok: false, error: 'entityId does not match an entity you have access to' });
    const user = userEvent.setup();
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log issue' }));

    expect(await screen.findByText('entityId does not match an entity you have access to')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createIssueMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log issue' }));

    expect(await screen.findByText('Failed to create issue.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createIssueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText('Priority'), 'HIGH');
    await user.click(screen.getByRole('button', { name: 'Log issue' }));

    expect(await screen.findByLabelText('Project')).toHaveValue('');
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Priority')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createIssueMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateIssueForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log issue' }));

    const pendingButton = screen.getByRole('button', { name: 'Logging...' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Log issue' })).not.toBeDisabled();
  });
});
