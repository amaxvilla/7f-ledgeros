import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const approveMasterPlanMock = vi.fn();
vi.mock('../actions', () => ({
  approveMasterPlan: (...args: unknown[]) => approveMasterPlanMock(...args),
}));

import { MasterPlanActions } from '../MasterPlanActions';

beforeEach(() => {
  approveMasterPlanMock.mockReset();
});

describe('MasterPlanActions — visibility', () => {
  it('shows Approve for a DRAFT master plan', () => {
    render(<MasterPlanActions id="mp-1" status="DRAFT" estateId="estate-1" />);

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('renders nothing for an already-APPROVED master plan', () => {
    const { container } = render(<MasterPlanActions id="mp-1" status="APPROVED" estateId="estate-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a SUPERSEDED master plan', () => {
    const { container } = render(<MasterPlanActions id="mp-1" status="SUPERSEDED" estateId="estate-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders no Reject button at all — there is no reject counterpart', () => {
    render(<MasterPlanActions id="mp-1" status="DRAFT" estateId="estate-1" />);

    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('MasterPlanActions — Approve', () => {
  it('calls approveMasterPlan with (id, estateId)', async () => {
    approveMasterPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<MasterPlanActions id="mp-1" status="DRAFT" estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(approveMasterPlanMock).toHaveBeenCalledWith('mp-1', 'estate-1');
  });

  it('shows the action-returned error message on failure', async () => {
    approveMasterPlanMock.mockResolvedValue({ ok: false, error: 'Master plan is already approved' });
    const user = userEvent.setup();
    render(<MasterPlanActions id="mp-1" status="DRAFT" estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Master plan is already approved')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    approveMasterPlanMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<MasterPlanActions id="mp-1" status="DRAFT" estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Failed to approve master plan.')).toBeInTheDocument();
  });

  it('disables the Approve button and shows the pending label while approving', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    approveMasterPlanMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<MasterPlanActions id="mp-1" status="DRAFT" estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('button', { name: 'Approving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Approve' })).not.toBeDisabled();
  });
});
