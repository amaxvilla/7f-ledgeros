import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createToolboxTalkMock = vi.fn();
vi.mock('../actions', () => ({
  createToolboxTalk: (...args: unknown[]) => createToolboxTalkMock(...args),
}));

import { CreateToolboxTalkForm } from '../CreateToolboxTalkForm';

const PROJECT_OPTIONS = [{ value: 'proj-1', label: 'PRJ-001 — Riverside Tower' }];

beforeEach(() => {
  createToolboxTalkMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Topic'), 'Working at heights');
  await user.type(screen.getByLabelText('Date'), '2026-08-01');
  await user.type(screen.getByLabelText('Conducted by'), 'Site Supervisor A');
  await user.type(screen.getByLabelText('Attendee count'), '12');
}

describe('CreateToolboxTalkForm', () => {
  it('renders every field', () => {
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Conducted by')).toBeInTheDocument();
    expect(screen.getByLabelText('Attendee count')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log toolbox talk' })).toBeInTheDocument();
  });

  it('marks Project and Notes as not required, and the rest as required', () => {
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Notes (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Topic')).toBeRequired();
    expect(screen.getByLabelText('Date')).toBeRequired();
    expect(screen.getByLabelText('Conducted by')).toBeRequired();
    expect(screen.getByLabelText('Attendee count')).toBeRequired();
  });

  it('submits entityId (from props, not a field) plus all required fields, with optional fields omitted when blank', async () => {
    createToolboxTalkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log toolbox talk' }));

    expect(createToolboxTalkMock).toHaveBeenCalledWith({
      entityId: 'entity-1',
      projectId: undefined,
      topic: 'Working at heights',
      talkDate: '2026-08-01',
      conductedById: 'Site Supervisor A',
      attendeeCount: 12,
      notes: undefined,
    });
  });

  it('sends attendeeCount as a number, not a string', async () => {
    createToolboxTalkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log toolbox talk' }));

    const call = createToolboxTalkMock.mock.calls[0][0];
    expect(call.attendeeCount).toBe(12);
    expect(typeof call.attendeeCount).toBe('number');
  });

  it('includes projectId and notes when filled in', async () => {
    createToolboxTalkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Project (optional)'), 'proj-1');
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Notes (optional)'), 'Good attendance');
    await user.click(screen.getByRole('button', { name: 'Log toolbox talk' }));

    const call = createToolboxTalkMock.mock.calls[0][0];
    expect(call.projectId).toBe('proj-1');
    expect(call.notes).toBe('Good attendance');
  });

  it('clears the form on success', async () => {
    createToolboxTalkMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log toolbox talk' }));

    expect(screen.getByLabelText('Topic')).toHaveValue('');
    expect(screen.getByLabelText('Conducted by')).toHaveValue('');
    expect(screen.getByLabelText('Attendee count')).toHaveValue(null);
  });

  it('shows the server error and keeps field values on failure', async () => {
    createToolboxTalkMock.mockResolvedValue({ ok: false, error: 'Attendee count cannot be negative' });
    const user = userEvent.setup();
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log toolbox talk' }));

    expect(await screen.findByText('Attendee count cannot be negative')).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toHaveValue('Working at heights');
  });

  it('shows a generic error message when the failure has none', async () => {
    createToolboxTalkMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log toolbox talk' }));

    expect(await screen.findByText('Failed to log toolbox talk.')).toBeInTheDocument();
  });

  it('disables the submit button and shows pending text while submitting', async () => {
    let resolvePromise: (value: { ok: boolean }) => void;
    createToolboxTalkMock.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));
    const user = userEvent.setup();
    render(<CreateToolboxTalkForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Log toolbox talk' }));

    expect(screen.getByRole('button', { name: 'Logging…' })).toBeDisabled();
    resolvePromise!({ ok: true });
  });
});
