import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createSurveyPlanMock = vi.fn();
vi.mock('../actions', () => ({
  createSurveyPlan: (...args: unknown[]) => createSurveyPlanMock(...args),
}));

import { CreateSurveyPlanForm } from '../CreateSurveyPlanForm';

beforeEach(() => {
  createSurveyPlanMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Plan number'), 'SP-001');
}

describe('CreateSurveyPlanForm', () => {
  it('renders every field', () => {
    render(<CreateSurveyPlanForm parcelId="parcel-1" />);

    expect(screen.getByLabelText('Plan number')).toBeInTheDocument();
    expect(screen.getByLabelText('Surveyor (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Survey date (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Area sqm (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Document ref (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add survey plan' })).toBeInTheDocument();
  });

  it('marks only Plan number as required', () => {
    render(<CreateSurveyPlanForm parcelId="parcel-1" />);

    expect(screen.getByLabelText('Plan number')).toBeRequired();
    expect(screen.getByLabelText('Surveyor (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Survey date (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Area sqm (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Document ref (optional)')).not.toBeRequired();
  });

  it('submits with optional fields as undefined when left blank', async () => {
    createSurveyPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateSurveyPlanForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add survey plan' }));

    expect(createSurveyPlanMock).toHaveBeenCalledWith({
      parcelId: 'parcel-1',
      planNumber: 'SP-001',
      surveyorName: undefined,
      surveyDate: undefined,
      areaSqm: undefined,
      documentRef: undefined,
    });
  });

  it('includes optional fields, with areaSqm converted to a number, when filled in', async () => {
    createSurveyPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateSurveyPlanForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Surveyor (optional)'), 'Jane Okoro');
    await user.type(screen.getByLabelText('Survey date (optional)'), '2026-07-15');
    await user.type(screen.getByLabelText('Area sqm (optional)'), '1200.5');
    await user.type(screen.getByLabelText('Document ref (optional)'), 'DOC-99');
    await user.click(screen.getByRole('button', { name: 'Add survey plan' }));

    expect(createSurveyPlanMock).toHaveBeenCalledWith({
      parcelId: 'parcel-1',
      planNumber: 'SP-001',
      surveyorName: 'Jane Okoro',
      surveyDate: '2026-07-15',
      areaSqm: 1200.5,
      documentRef: 'DOC-99',
    });
  });

  it('shows the action-returned error message on failure', async () => {
    createSurveyPlanMock.mockResolvedValue({ ok: false, error: 'Survey plan "SP-001" already exists for this parcel' });
    const user = userEvent.setup();
    render(<CreateSurveyPlanForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add survey plan' }));

    expect(await screen.findByText('Survey plan "SP-001" already exists for this parcel')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createSurveyPlanMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateSurveyPlanForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add survey plan' }));

    expect(await screen.findByText('Failed to add survey plan.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createSurveyPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateSurveyPlanForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Surveyor (optional)'), 'Jane Okoro');
    await user.click(screen.getByRole('button', { name: 'Add survey plan' }));

    expect(await screen.findByLabelText('Plan number')).toHaveValue('');
    expect(screen.getByLabelText('Surveyor (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createSurveyPlanMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateSurveyPlanForm parcelId="parcel-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add survey plan' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add survey plan' })).not.toBeDisabled();
  });
});
