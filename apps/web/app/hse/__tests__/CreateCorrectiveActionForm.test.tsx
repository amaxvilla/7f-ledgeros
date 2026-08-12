import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createCorrectiveActionMock = vi.fn();
vi.mock('../actions', () => ({
  createCorrectiveAction: (...args: unknown[]) => createCorrectiveActionMock(...args),
}));

import { CreateCorrectiveActionForm } from '../CreateCorrectiveActionForm';

const LINK_OPTIONS = [
  { value: 'incident:inc-1', label: 'Incident — 8/1/2026 — Scaffolding collapse near block C' },
  { value: 'nearmiss:nm-1', label: 'Near miss — 7/28/2026 — Forklift near-collision' },
];

beforeEach(() => {
  createCorrectiveActionMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>, linkValue = 'incident:inc-1') {
  await user.selectOptions(screen.getByLabelText('Linked to'), linkValue);
  await user.type(screen.getByLabelText('Description'), 'Re-secure scaffolding and inspect welds');
  await user.type(screen.getByLabelText('Due date'), '2026-08-15');
}

describe('CreateCorrectiveActionForm', () => {
  it('renders every field', () => {
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    expect(screen.getByLabelText('Linked to')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Assigned to (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Due date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log corrective action' })).toBeInTheDocument();
  });

  it('marks Assigned to as not required, and the rest as required', () => {
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    expect(screen.getByLabelText('Assigned to (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Linked to')).toBeRequired();
    expect(screen.getByLabelText('Description')).toBeRequired();
    expect(screen.getByLabelText('Due date')).toBeRequired();
  });

  it('splits an incident: link into incidentReportId, leaving nearMissId undefined', async () => {
    createCorrectiveActionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    await fillRequiredFields(user, 'incident:inc-1');
    await user.click(screen.getByRole('button', { name: 'Log corrective action' }));

    expect(createCorrectiveActionMock).toHaveBeenCalledWith({
      incidentReportId: 'inc-1',
      nearMissId: undefined,
      description: 'Re-secure scaffolding and inspect welds',
      assignedToId: undefined,
      dueDate: '2026-08-15',
    });
  });

  it('splits a nearmiss: link into nearMissId, leaving incidentReportId undefined', async () => {
    createCorrectiveActionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    await fillRequiredFields(user, 'nearmiss:nm-1');
    await user.click(screen.getByRole('button', { name: 'Log corrective action' }));

    expect(createCorrectiveActionMock).toHaveBeenCalledWith({
      incidentReportId: undefined,
      nearMissId: 'nm-1',
      description: 'Re-secure scaffolding and inspect welds',
      assignedToId: undefined,
      dueDate: '2026-08-15',
    });
  });

  it('includes assignedToId when filled in', async () => {
    createCorrectiveActionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Assigned to (optional)'), 'user-9');
    await user.click(screen.getByRole('button', { name: 'Log corrective action' }));

    expect(createCorrectiveActionMock).toHaveBeenCalledWith(expect.objectContaining({ assignedToId: 'user-9' }));
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createCorrectiveActionMock.mockResolvedValue({ ok: false, error: 'A corrective action must reference an incident report or a near miss' });
    const user = userEvent.setup();
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log corrective action' }));

    expect(await screen.findByText('A corrective action must reference an incident report or a near miss')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Re-secure scaffolding and inspect welds');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createCorrectiveActionMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log corrective action' }));

    expect(await screen.findByText('Failed to create corrective action.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createCorrectiveActionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Assigned to (optional)'), 'user-9');
    await user.click(screen.getByRole('button', { name: 'Log corrective action' }));

    expect(await screen.findByLabelText('Linked to')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Assigned to (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Due date')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createCorrectiveActionMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateCorrectiveActionForm linkOptions={LINK_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log corrective action' }));

    expect(screen.getByRole('button', { name: 'Logging…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Log corrective action' })).not.toBeDisabled();
  });
});
