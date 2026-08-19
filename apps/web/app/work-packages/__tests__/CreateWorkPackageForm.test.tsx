import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createWorkPackageMock = vi.fn();
vi.mock('../actions', () => ({
  createWorkPackage: (...args: unknown[]) => createWorkPackageMock(...args),
}));

import { CreateWorkPackageForm } from '../CreateWorkPackageForm';

const PROJECT_OPTIONS = [
  { value: 'proj-1', label: 'PRJ-001 — Riverside Towers' },
  { value: 'proj-2', label: 'PRJ-002 — Harbor View Estate' },
];

beforeEach(() => {
  createWorkPackageMock.mockReset();
});

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  {
    project = 'proj-1',
    code = 'WP-001',
    name = 'Substructure works',
    contractorId = 'contractor-1',
    description,
    budgetAmount = '500000',
  }: {
    project?: string;
    code?: string;
    name?: string;
    contractorId?: string;
    description?: string;
    budgetAmount?: string;
  } = {},
) {
  await user.selectOptions(screen.getByLabelText('Project'), project);
  await user.type(screen.getByLabelText('Code'), code);
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Contractor ID'), contractorId);
  if (description) await user.type(screen.getByLabelText('Description (optional)'), description);
  await user.type(screen.getByLabelText('Budget amount'), budgetAmount);
}

describe('CreateWorkPackageForm', () => {
  it('renders every field', () => {
    render(<CreateWorkPackageForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Contractor ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create work package' })).toBeInTheDocument();
  });

  it('lists the supplied project options', () => {
    render(<CreateWorkPackageForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    const select = screen.getByLabelText('Project') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('proj-1');
    expect(values).toContain('proj-2');
  });

  it('submits with numeric budgetAmount conversion and no description when left blank', async () => {
    createWorkPackageMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateWorkPackageForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create work package' }));

    expect(createWorkPackageMock).toHaveBeenCalledWith({
      projectId: 'proj-1',
      contractorId: 'contractor-1',
      code: 'WP-001',
      name: 'Substructure works',
      description: undefined,
      budgetAmount: 500000,
    });
  });

  it('includes description when filled in', async () => {
    createWorkPackageMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateWorkPackageForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillForm(user, { description: 'Foundations and substructure' });
    await user.click(screen.getByRole('button', { name: 'Create work package' }));

    expect(createWorkPackageMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Foundations and substructure' }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createWorkPackageMock.mockResolvedValue({ ok: false, error: 'Work package code "WP-001" already exists on this project' });
    const user = userEvent.setup();
    render(<CreateWorkPackageForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create work package' }));

    expect(await screen.findByText('Work package code "WP-001" already exists on this project')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createWorkPackageMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateWorkPackageForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create work package' }));

    expect(await screen.findByText('Failed to create work package.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createWorkPackageMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateWorkPackageForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillForm(user, { description: 'Foundations and substructure' });
    await user.click(screen.getByRole('button', { name: 'Create work package' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Contractor ID')).toHaveValue('');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Budget amount')).toHaveValue(null);
    expect(screen.getByLabelText('Project')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createWorkPackageMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateWorkPackageForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create work package' }));

    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create work package' })).not.toBeDisabled();
  });
});
