import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same reasoning as VacancyActions.test.tsx's own ./actions mock.
const submitRequisitionMock = vi.fn();
const refreshRequisitionApprovalMock = vi.fn();
const closeRequisitionMock = vi.fn();
vi.mock('../actions', () => ({
  submitRequisition: (...args: unknown[]) => submitRequisitionMock(...args),
  refreshRequisitionApproval: (...args: unknown[]) => refreshRequisitionApprovalMock(...args),
  closeRequisition: (...args: unknown[]) => closeRequisitionMock(...args),
}));

import { RequisitionActions } from '../RequisitionActions';

beforeEach(() => {
  submitRequisitionMock.mockReset();
  refreshRequisitionApprovalMock.mockReset();
  closeRequisitionMock.mockReset();
});

describe('RequisitionActions', () => {
  it('shows Submit and Close, but not Refresh approval, for a DRAFT requisition with no workflow yet', () => {
    render(<RequisitionActions id="req-1" status="DRAFT" hasWorkflowInstance={false} />);

    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh approval' })).not.toBeInTheDocument();
  });

  it('shows Refresh approval and Close, but not Submit, for a PENDING_APPROVAL requisition with a workflow instance', () => {
    render(<RequisitionActions id="req-1" status="PENDING_APPROVAL" hasWorkflowInstance={true} />);

    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh approval' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('hides Refresh approval for PENDING_APPROVAL if no workflow instance was actually started', () => {
    render(<RequisitionActions id="req-1" status="PENDING_APPROVAL" hasWorkflowInstance={false} />);

    expect(screen.queryByRole('button', { name: 'Refresh approval' })).not.toBeInTheDocument();
  });

  it('shows only Close for an APPROVED requisition', () => {
    render(<RequisitionActions id="req-1" status="APPROVED" hasWorkflowInstance={true} />);

    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh approval' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows only Close for a REJECTED or ON_HOLD requisition', () => {
    const { rerender } = render(<RequisitionActions id="req-1" status="REJECTED" hasWorkflowInstance={true} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();

    rerender(<RequisitionActions id="req-1" status="ON_HOLD" hasWorkflowInstance={false} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });

  it('shows no actions, just a dash, for a terminal CLOSED requisition', () => {
    render(<RequisitionActions id="req-1" status="CLOSED" hasWorkflowInstance={true} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls submitRequisition with the requisition id when Submit is clicked', async () => {
    submitRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RequisitionActions id="req-42" status="DRAFT" hasWorkflowInstance={false} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(submitRequisitionMock).toHaveBeenCalledWith('req-42');
  });

  it('calls refreshRequisitionApproval with the requisition id when Refresh approval is clicked', async () => {
    refreshRequisitionApprovalMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RequisitionActions id="req-42" status="PENDING_APPROVAL" hasWorkflowInstance={true} />);

    await user.click(screen.getByRole('button', { name: 'Refresh approval' }));

    expect(refreshRequisitionApprovalMock).toHaveBeenCalledWith('req-42');
  });

  it('calls closeRequisition with the requisition id when Close is clicked', async () => {
    closeRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RequisitionActions id="req-42" status="DRAFT" hasWorkflowInstance={false} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(closeRequisitionMock).toHaveBeenCalledWith('req-42');
  });

  it('shows the action-returned error message on failure', async () => {
    submitRequisitionMock.mockResolvedValue({ ok: false, error: 'No available budget remains on the linked budget line (0)' });
    const user = userEvent.setup();
    render(<RequisitionActions id="req-42" status="DRAFT" hasWorkflowInstance={false} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('No available budget remains on the linked budget line (0)')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    refreshRequisitionApprovalMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RequisitionActions id="req-42" status="PENDING_APPROVAL" hasWorkflowInstance={true} />);

    await user.click(screen.getByRole('button', { name: 'Refresh approval' }));

    expect(await screen.findByText('Failed to refresh approval status.')).toBeInTheDocument();
  });

  it('disables all actions and shows a pending label while a request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    submitRequisitionMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RequisitionActions id="req-42" status="DRAFT" hasWorkflowInstance={false} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Submit' })).not.toBeDisabled();
  });
});
