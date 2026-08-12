import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createRiskMock = vi.fn();
vi.mock('../actions', () => ({
  createRisk: (...args: unknown[]) => createRiskMock(...args),
}));

import { CreateRiskForm } from '../CreateRiskForm';

const PROJECT_OPTIONS = [
  { value: 'proj-1', label: 'PRJ-001 — The Shore' },
  { value: 'proj-2', label: 'PRJ-002 — The Cove' },
];

beforeEach(() => {
  createRiskMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
  await user.type(screen.getByLabelText('Title'), 'Contractor delay on Phase 2');
}

describe('CreateRiskForm', () => {
  it('renders every field with its label', () => {
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Category (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Probability')).toBeInTheDocument();
    expect(screen.getByLabelText('Impact')).toBeInTheDocument();
    expect(screen.getByLabelText('Owner ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log risk' })).toBeInTheDocument();
  });

  it('populates the Project Select from the projectOptions prop', () => {
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByRole('option', { name: 'PRJ-001 — The Shore' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PRJ-002 — The Cove' })).toBeInTheDocument();
  });

  it('marks Project and Title as required, and every other field optional', () => {
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project')).toBeRequired();
    expect(screen.getByLabelText('Title')).toBeRequired();
    expect(screen.getByLabelText('Category (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Probability')).not.toBeRequired();
    expect(screen.getByLabelText('Impact')).not.toBeRequired();
    expect(screen.getByLabelText('Owner ID (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Description (optional)')).not.toBeRequired();
  });

  it('submits with optional fields, including probability/impact, as undefined when left blank', async () => {
    createRiskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log risk' }));

    expect(createRiskMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      projectId: 'proj-1',
      title: 'Contractor delay on Phase 2',
      description: undefined,
      category: undefined,
      probability: undefined,
      impact: undefined,
      ownerId: undefined,
    });
  });

  it('includes optional fields, including the selected probability/impact, when filled in', async () => {
    createRiskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Category (optional)'), 'Schedule');
    await user.selectOptions(screen.getByLabelText('Probability'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Impact'), 'MEDIUM');
    await user.type(screen.getByLabelText('Owner ID (optional)'), 'user-9');
    await user.type(screen.getByLabelText('Description (optional)'), 'Delay may cascade to Phase 3');
    await user.click(screen.getByRole('button', { name: 'Log risk' }));

    expect(createRiskMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      projectId: 'proj-1',
      title: 'Contractor delay on Phase 2',
      description: 'Delay may cascade to Phase 3',
      category: 'Schedule',
      probability: 'HIGH',
      impact: 'MEDIUM',
      ownerId: 'user-9',
    });
  });

  it('shows the action-returned error message on failure', async () => {
    createRiskMock.mockResolvedValue({ ok: false, error: 'entityId does not match an entity you have access to' });
    const user = userEvent.setup();
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log risk' }));

    expect(await screen.findByText('entityId does not match an entity you have access to')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createRiskMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log risk' }));

    expect(await screen.findByText('Failed to create risk.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createRiskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText('Probability'), 'HIGH');
    await user.click(screen.getByRole('button', { name: 'Log risk' }));

    expect(await screen.findByLabelText('Project')).toHaveValue('');
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Probability')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createRiskMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateRiskForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log risk' }));

    const pendingButton = screen.getByRole('button', { name: 'Logging…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Log risk' })).not.toBeDisabled();
  });
});
