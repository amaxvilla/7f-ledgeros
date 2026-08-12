import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same reasoning as CreateVacancyForm.test.tsx's own ./actions mock.
const createRequisitionMock = vi.fn();
vi.mock('../actions', () => ({
  createRequisition: (...args: unknown[]) => createRequisitionMock(...args),
}));

import { CreateRequisitionForm } from '../CreateRequisitionForm';

beforeEach(() => {
  createRequisitionMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Job title'), 'Senior Backend Engineer');
}

describe('CreateRequisitionForm', () => {
  it('renders every field with its label', () => {
    render(<CreateRequisitionForm entityId="ent-1" />);

    expect(screen.getByLabelText('Job title')).toBeInTheDocument();
    expect(screen.getByLabelText('Department ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Cost center ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Project ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Grade level (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Employment type')).toBeInTheDocument();
    expect(screen.getByLabelText('Headcount (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget line ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Justification (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add requisition' })).toBeInTheDocument();
  });

  it('marks only jobTitle as required', () => {
    render(<CreateRequisitionForm entityId="ent-1" />);

    expect(screen.getByLabelText('Job title')).toBeRequired();
    expect(screen.getByLabelText('Department ID (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Cost center ID (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Project ID (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Grade level (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Employment type')).not.toBeRequired();
    expect(screen.getByLabelText('Headcount (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Budget line ID (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Justification (optional)')).not.toBeRequired();
  });

  it('submits with entityId and jobTitle, and every optional field omitted (undefined) when left blank', async () => {
    createRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add requisition' }));

    expect(createRequisitionMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      jobTitle: 'Senior Backend Engineer',
      departmentId: undefined,
      costCenterId: undefined,
      projectId: undefined,
      gradeLevel: undefined,
      employmentType: undefined,
      headcount: undefined,
      justification: undefined,
      budgetLineId: undefined,
    });
  });

  it('includes every optional field when filled in, converting headcount to a number', async () => {
    createRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Department ID (optional)'), 'dept-1');
    await user.type(screen.getByLabelText('Cost center ID (optional)'), 'cc-1');
    await user.type(screen.getByLabelText('Project ID (optional)'), 'proj-1');
    await user.type(screen.getByLabelText('Grade level (optional)'), 'L5');
    await user.selectOptions(screen.getByLabelText('Employment type'), 'CONTRACT');
    await user.type(screen.getByLabelText('Headcount (optional)'), '3');
    await user.type(screen.getByLabelText('Budget line ID (optional)'), 'bl-1');
    await user.type(screen.getByLabelText('Justification (optional)'), 'Backfill for attrition');
    await user.click(screen.getByRole('button', { name: 'Add requisition' }));

    expect(createRequisitionMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      jobTitle: 'Senior Backend Engineer',
      departmentId: 'dept-1',
      costCenterId: 'cc-1',
      projectId: 'proj-1',
      gradeLevel: 'L5',
      employmentType: 'CONTRACT',
      headcount: 3,
      justification: 'Backfill for attrition',
      budgetLineId: 'bl-1',
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createRequisitionMock.mockResolvedValue({ ok: false, error: 'jobTitle is required' });
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add requisition' }));

    expect(await screen.findByText('jobTitle is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Job title')).toHaveValue('Senior Backend Engineer');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createRequisitionMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add requisition' }));

    expect(await screen.findByText('Failed to create requisition.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Grade level (optional)'), 'L5');
    await user.click(screen.getByRole('button', { name: 'Add requisition' }));

    expect(await screen.findByLabelText('Job title')).toHaveValue('');
    expect(screen.getByLabelText('Grade level (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createRequisitionMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateRequisitionForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add requisition' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add requisition' })).not.toBeDisabled();
  });
});
