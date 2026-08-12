import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const approveSurveyPlanMock = vi.fn();
const rejectSurveyPlanMock = vi.fn();
vi.mock('../actions', () => ({
  approveSurveyPlan: (...args: unknown[]) => approveSurveyPlanMock(...args),
  rejectSurveyPlan: (...args: unknown[]) => rejectSurveyPlanMock(...args),
}));

import { SurveyPlanActions } from '../SurveyPlanActions';

beforeEach(() => {
  approveSurveyPlanMock.mockReset();
  rejectSurveyPlanMock.mockReset();
});

describe('SurveyPlanActions — visibility', () => {
  it('shows Approve and Reject for a DRAFT survey plan', () => {
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows Approve and Reject for a SUBMITTED survey plan', () => {
    render(<SurveyPlanActions id="sp-1" status="SUBMITTED" parcelId="parcel-1" />);

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('renders nothing for an already-APPROVED survey plan', () => {
    const { container } = render(<SurveyPlanActions id="sp-1" status="APPROVED" parcelId="parcel-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a REJECTED survey plan', () => {
    const { container } = render(<SurveyPlanActions id="sp-1" status="REJECTED" parcelId="parcel-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('gives Approve no input fields of its own — only the Reject reason textbox is present', () => {
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByLabelText('Rejection reason')).toBeInTheDocument();
  });
});

describe('SurveyPlanActions — Approve', () => {
  it('calls approveSurveyPlan with (id, parcelId) — no third argument', async () => {
    approveSurveyPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(approveSurveyPlanMock).toHaveBeenCalledWith('sp-1', 'parcel-1');
  });

  it('shows the action-returned error message on Approve failure', async () => {
    approveSurveyPlanMock.mockResolvedValue({ ok: false, error: 'Survey plan is already approved' });
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Survey plan is already approved')).toBeInTheDocument();
  });

  it('falls back to a generic error message when Approve fails without one', async () => {
    approveSurveyPlanMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Failed to approve survey plan.')).toBeInTheDocument();
  });

  it('disables the Approve button and shows the pending label while approving', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    approveSurveyPlanMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('button', { name: 'Approving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Approve' })).not.toBeDisabled();
  });
});

describe('SurveyPlanActions — Reject', () => {
  it('marks the rejection reason as required', () => {
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    expect(screen.getByLabelText('Rejection reason')).toBeRequired();
  });

  it('calls rejectSurveyPlan with (id, reason, parcelId)', async () => {
    rejectSurveyPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Boundary dispute unresolved');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(rejectSurveyPlanMock).toHaveBeenCalledWith('sp-1', 'Boundary dispute unresolved', 'parcel-1');
  });

  it('shows the action-returned error message on Reject failure', async () => {
    rejectSurveyPlanMock.mockResolvedValue({ ok: false, error: 'Survey plan not found' });
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Boundary dispute unresolved');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Survey plan not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when Reject fails without one', async () => {
    rejectSurveyPlanMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Boundary dispute unresolved');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Failed to reject survey plan.')).toBeInTheDocument();
  });

  it('resets the reason field after a successful reject', async () => {
    rejectSurveyPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Boundary dispute unresolved');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByLabelText('Rejection reason')).toHaveValue('');
  });

  it('disables the Reject button and shows the pending label while rejecting', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    rejectSurveyPlanMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<SurveyPlanActions id="sp-1" status="DRAFT" parcelId="parcel-1" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Boundary dispute unresolved');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(screen.getByRole('button', { name: 'Rejecting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reject' })).not.toBeDisabled();
  });
});
