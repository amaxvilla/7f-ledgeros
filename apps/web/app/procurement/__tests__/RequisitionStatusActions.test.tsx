import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const submitRequisitionMock = vi.fn();
const approveRequisitionMock = vi.fn();
const rejectRequisitionMock = vi.fn();

vi.mock('../actions', () => ({
  submitRequisition: (...args: unknown[]) => submitRequisitionMock(...args),
  approveRequisition: (...args: unknown[]) => approveRequisitionMock(...args),
  rejectRequisition: (...args: unknown[]) => rejectRequisitionMock(...args),
}));

import { RequisitionStatusActions } from '../RequisitionStatusActions';

beforeEach(() => {
  submitRequisitionMock.mockReset();
  approveRequisitionMock.mockReset();
  rejectRequisitionMock.mockReset();
});

describe('RequisitionStatusActions', () => {
  it('shows "Submit" for a DRAFT requisition', () => {
    render(<RequisitionStatusActions id="pr-1" status="DRAFT" />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('shows "Submit" for a REJECTED requisition', () => {
    render(<RequisitionStatusActions id="pr-1" status="REJECTED" />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('shows a comments field, Approve, and Reject for a SUBMITTED requisition', () => {
    render(<RequisitionStatusActions id="pr-1" status="SUBMITTED" />);
    expect(screen.getByLabelText('Comments (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows a dash for an APPROVED requisition', () => {
    render(<RequisitionStatusActions id="pr-1" status="APPROVED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls submitRequisition when "Submit" is clicked', async () => {
    submitRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RequisitionStatusActions id="pr-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(submitRequisitionMock).toHaveBeenCalledWith('pr-42');
  });

  it('calls approveRequisition with trimmed comments when "Approve" is clicked', async () => {
    approveRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RequisitionStatusActions id="pr-42" status="SUBMITTED" />);

    await user.type(screen.getByLabelText('Comments (optional)'), '  Looks good  ');
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(approveRequisitionMock).toHaveBeenCalledWith('pr-42', 'Looks good');
  });

  it('calls rejectRequisition with undefined comments when left blank', async () => {
    rejectRequisitionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RequisitionStatusActions id="pr-42" status="SUBMITTED" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(rejectRequisitionMock).toHaveBeenCalledWith('pr-42', undefined);
  });

  it('shows an error message when an action fails', async () => {
    submitRequisitionMock.mockResolvedValue({ ok: false, error: 'Failed to submit requisition.' });
    const user = userEvent.setup();
    render(<RequisitionStatusActions id="pr-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Failed to submit requisition.')).toBeInTheDocument();
  });
});
