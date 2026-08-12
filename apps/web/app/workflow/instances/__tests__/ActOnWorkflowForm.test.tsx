import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actOnWorkflowInstanceMock = vi.fn();
vi.mock('../actions', () => ({
  actOnWorkflowInstance: (...args: unknown[]) => actOnWorkflowInstanceMock(...args),
}));

import { ActOnWorkflowForm } from '../ActOnWorkflowForm';

beforeEach(() => {
  actOnWorkflowInstanceMock.mockReset();
});

describe('ActOnWorkflowForm', () => {
  it('renders the action select, comments field, and submit button', () => {
    render(<ActOnWorkflowForm instanceId="inst-1" />);

    expect(screen.getByLabelText('Action')).toBeInTheDocument();
    expect(screen.getByLabelText('Comments (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit action' })).toBeInTheDocument();
  });

  it('offers all 8 WorkflowActionType values', () => {
    render(<ActOnWorkflowForm instanceId="inst-1" />);

    const select = screen.getByLabelText('Action') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(['SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'POST', 'ARCHIVE', 'COMMENT']);
  });

  it('marks Action required and Comments not required', () => {
    render(<ActOnWorkflowForm instanceId="inst-1" />);

    expect(screen.getByLabelText('Action')).toBeRequired();
    expect(screen.getByLabelText('Comments (optional)')).not.toBeRequired();
  });

  it('submits instanceId (from props), the chosen action, and comments', async () => {
    actOnWorkflowInstanceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ActOnWorkflowForm instanceId="inst-42" />);

    await user.selectOptions(screen.getByLabelText('Action'), 'APPROVE');
    await user.type(screen.getByLabelText('Comments (optional)'), 'Looks good');
    await user.click(screen.getByRole('button', { name: 'Submit action' }));

    expect(actOnWorkflowInstanceMock).toHaveBeenCalledWith('inst-42', 'APPROVE', 'Looks good');
  });

  it('omits comments when left blank', async () => {
    actOnWorkflowInstanceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ActOnWorkflowForm instanceId="inst-42" />);

    await user.selectOptions(screen.getByLabelText('Action'), 'REJECT');
    await user.click(screen.getByRole('button', { name: 'Submit action' }));

    expect(actOnWorkflowInstanceMock).toHaveBeenCalledWith('inst-42', 'REJECT', undefined);
  });

  it('clears the form on success', async () => {
    actOnWorkflowInstanceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ActOnWorkflowForm instanceId="inst-42" />);

    await user.selectOptions(screen.getByLabelText('Action'), 'APPROVE');
    await user.type(screen.getByLabelText('Comments (optional)'), 'Looks good');
    await user.click(screen.getByRole('button', { name: 'Submit action' }));

    expect(screen.getByLabelText('Comments (optional)')).toHaveValue('');
  });

  it('shows the server error and keeps field values on failure', async () => {
    actOnWorkflowInstanceMock.mockResolvedValue({ ok: false, error: 'This stage requires role CFO to act' });
    const user = userEvent.setup();
    render(<ActOnWorkflowForm instanceId="inst-42" />);

    await user.selectOptions(screen.getByLabelText('Action'), 'APPROVE');
    await user.click(screen.getByRole('button', { name: 'Submit action' }));

    expect(await screen.findByText('This stage requires role CFO to act')).toBeInTheDocument();
  });

  it('shows a generic error message when the failure has none', async () => {
    actOnWorkflowInstanceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<ActOnWorkflowForm instanceId="inst-42" />);

    await user.selectOptions(screen.getByLabelText('Action'), 'APPROVE');
    await user.click(screen.getByRole('button', { name: 'Submit action' }));

    expect(await screen.findByText('Failed to record workflow action.')).toBeInTheDocument();
  });

  it('disables the submit button and shows pending text while submitting', async () => {
    let resolvePromise: (value: { ok: boolean }) => void = () => {};
    actOnWorkflowInstanceMock.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));
    const user = userEvent.setup();
    render(<ActOnWorkflowForm instanceId="inst-42" />);

    await user.selectOptions(screen.getByLabelText('Action'), 'APPROVE');
    await user.click(screen.getByRole('button', { name: 'Submit action' }));

    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    resolvePromise({ ok: true });
  });
});
