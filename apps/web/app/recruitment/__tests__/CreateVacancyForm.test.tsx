import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same reasoning as packages/ui/src/components/__tests__/Nav.test.tsx's
// own next/navigation mock: createVacancy is a 'use server' action,
// not a real server in this test environment, so the whole ./actions
// module is mocked. Mocked before the component import so the module
// under test picks up the mock, not the real 'use server' file.
const createVacancyMock = vi.fn();
vi.mock('../actions', () => ({
  createVacancy: (...args: unknown[]) => createVacancyMock(...args),
}));

import { CreateVacancyForm } from '../CreateVacancyForm';

const requisitions = [
  { id: 'req-123', jobTitle: 'Senior Backend Engineer' },
  { id: 'req-456', jobTitle: 'Product Designer' },
];

beforeEach(() => {
  createVacancyMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Job requisition'), 'req-123');
  await user.type(screen.getByLabelText('Title'), 'Senior Backend Engineer');
}

describe('CreateVacancyForm', () => {
  it('renders every field with its label, and one option per requisition', () => {
    render(<CreateVacancyForm entityId="ent-1" requisitions={requisitions} />);

    expect(screen.getByLabelText('Job requisition')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Senior Backend Engineer' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Product Designer' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Location (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Employment type')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add vacancy' })).toBeInTheDocument();
  });

  it('shows the empty-state message and no interactive control when the requisitions list is empty', () => {
    render(<CreateVacancyForm entityId="ent-1" requisitions={[]} />);

    // Select's own empty-options branch (packages/ui/src/components/Form.tsx,
    // FE-10.2) replaces the interactive <select> entirely with a plain
    // <div> — no <option> elements exist at all, and the text shown is
    // Select's own default emptyMessage ("No options available."), not this
    // form's `placeholder` string (which is only ever used inside the
    // <select> branch). Both were a pre-existing, real test/behavior/
    // doc-comment mismatch (see CreateVacancyForm.tsx's own FE-10.8
    // correction), fixed here, unrelated to this checkpoint's own change to
    // the form.
    expect(screen.getByText('No options available.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Job requisition' })).not.toBeInTheDocument();
  });

  it('marks jobRequisitionId and title as required, but the rest optional', () => {
    render(<CreateVacancyForm entityId="ent-1" requisitions={requisitions} />);

    expect(screen.getByLabelText('Job requisition')).toBeRequired();
    expect(screen.getByLabelText('Title')).toBeRequired();
    expect(screen.getByLabelText('Location (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Employment type')).not.toBeRequired();
    expect(screen.getByLabelText('Description (optional)')).not.toBeRequired();
  });

  it('submits with optional fields omitted (undefined, not empty strings) when left blank', async () => {
    createVacancyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateVacancyForm entityId="ent-1" requisitions={requisitions} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add vacancy' }));

    expect(createVacancyMock).toHaveBeenCalledWith({
      jobRequisitionId: 'req-123',
      title: 'Senior Backend Engineer',
      description: undefined,
      location: undefined,
      employmentType: undefined,
    });
  });

  it('includes optional fields when filled in, including the selected employment type', async () => {
    createVacancyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateVacancyForm entityId="ent-1" requisitions={requisitions} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Location (optional)'), 'Lagos, NG');
    await user.selectOptions(screen.getByLabelText('Employment type'), 'CONTRACT');
    await user.type(screen.getByLabelText('Description (optional)'), 'Remote-friendly');
    await user.click(screen.getByRole('button', { name: 'Add vacancy' }));

    expect(createVacancyMock).toHaveBeenCalledWith({
      jobRequisitionId: 'req-123',
      title: 'Senior Backend Engineer',
      description: 'Remote-friendly',
      location: 'Lagos, NG',
      employmentType: 'CONTRACT',
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createVacancyMock.mockResolvedValue({ ok: false, error: 'Vacancies can only be opened against an APPROVED requisition' });
    const user = userEvent.setup();
    render(<CreateVacancyForm entityId="ent-1" requisitions={requisitions} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add vacancy' }));

    expect(await screen.findByText('Vacancies can only be opened against an APPROVED requisition')).toBeInTheDocument();
    expect(screen.getByLabelText('Job requisition')).toHaveValue('req-123');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createVacancyMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateVacancyForm entityId="ent-1" requisitions={requisitions} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add vacancy' }));

    expect(await screen.findByText('Failed to create vacancy.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createVacancyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateVacancyForm entityId="ent-1" requisitions={requisitions} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Location (optional)'), 'Lagos, NG');
    await user.click(screen.getByRole('button', { name: 'Add vacancy' }));

    expect(await screen.findByLabelText('Job requisition')).toHaveValue('');
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Location (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createVacancyMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateVacancyForm entityId="ent-1" requisitions={requisitions} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add vacancy' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add vacancy' })).not.toBeDisabled();
  });
});
