import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createIncidentReportMock = vi.fn();
vi.mock('../actions', () => ({
  createIncidentReport: (...args: unknown[]) => createIncidentReportMock(...args),
}));

import { CreateIncidentReportForm } from '../CreateIncidentReportForm';

const PROJECT_OPTIONS = [
  { value: 'proj-1', label: 'PRJ-001 — Riverside Towers' },
  { value: 'proj-2', label: 'PRJ-002 — Harbor View Estate' },
];

beforeEach(() => {
  createIncidentReportMock.mockReset();
});

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  { date = '2026-08-01', description = 'Scaffolding collapse near block C', severity = 'SEVERE' } = {},
) {
  await user.type(screen.getByLabelText('Incident date'), date);
  await user.type(screen.getByLabelText('Description'), description);
  await user.selectOptions(screen.getByLabelText('Severity'), severity);
}

describe('CreateIncidentReportForm', () => {
  it('renders every field', () => {
    render(<CreateIncidentReportForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Incident date')).toBeInTheDocument();
    expect(screen.getByLabelText('Location (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Severity')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report incident' })).toBeInTheDocument();
  });

  it('marks Project and Location as not required, and the rest as required', () => {
    render(<CreateIncidentReportForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Location (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Incident date')).toBeRequired();
    expect(screen.getByLabelText('Description')).toBeRequired();
    expect(screen.getByLabelText('Severity')).toBeRequired();
  });

  it('submits entityId plus the entered fields, omitting project and location when left blank', async () => {
    createIncidentReportMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIncidentReportForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Report incident' }));

    expect(createIncidentReportMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      projectId: undefined,
      incidentDate: '2026-08-01',
      location: undefined,
      description: 'Scaffolding collapse near block C',
      severity: 'SEVERE',
    });
  });

  it('includes project and location when filled in', async () => {
    createIncidentReportMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIncidentReportForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Project (optional)'), 'proj-2');
    await user.type(screen.getByLabelText('Location (optional)'), 'Block C, Level 4');
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Report incident' }));

    expect(createIncidentReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-2', location: 'Block C, Level 4' }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createIncidentReportMock.mockResolvedValue({ ok: false, error: 'Entity ent-1 not found' });
    const user = userEvent.setup();
    render(<CreateIncidentReportForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Report incident' }));

    expect(await screen.findByText('Entity ent-1 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createIncidentReportMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateIncidentReportForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Report incident' }));

    expect(await screen.findByText('Failed to create incident report.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createIncidentReportMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateIncidentReportForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Project (optional)'), 'proj-2');
    await user.type(screen.getByLabelText('Location (optional)'), 'Block C, Level 4');
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Report incident' }));

    expect(await screen.findByLabelText('Incident date')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Location (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Project (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Severity')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createIncidentReportMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateIncidentReportForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Report incident' }));

    expect(screen.getByRole('button', { name: 'Reporting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Report incident' })).not.toBeDisabled();
  });
});
