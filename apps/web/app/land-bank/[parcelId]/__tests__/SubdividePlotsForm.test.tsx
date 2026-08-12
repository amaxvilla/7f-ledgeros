import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const subdivideParcelMock = vi.fn();
vi.mock('../actions', () => ({
  subdivideParcel: (...args: unknown[]) => subdivideParcelMock(...args),
}));

import { SubdividePlotsForm } from '../SubdividePlotsForm';

const SURVEY_PLAN_OPTIONS = [
  { value: 'sp-1', label: 'SP-001' },
  { value: 'sp-2', label: 'SP-002' },
];

beforeEach(() => {
  subdivideParcelMock.mockReset();
});

async function fillPlot(user: ReturnType<typeof userEvent.setup>, index: number, plotNumber: string, areaSqm: string) {
  await user.type(screen.getByLabelText(`Plot number (plot ${index})`), plotNumber);
  await user.type(screen.getByLabelText(`Area sqm (plot ${index})`), areaSqm);
}

describe('SubdividePlotsForm', () => {
  it('renders the survey plan select and a single plot row by default', () => {
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    expect(screen.getByLabelText('Approved survey plan')).toBeInTheDocument();
    expect(screen.getByLabelText('Plot number (plot 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Area sqm (plot 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Use type (plot 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes (plot 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Plot number (plot 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subdivide parcel' })).toBeInTheDocument();
  });

  it('lists the supplied survey plan options', () => {
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    const select = screen.getByLabelText('Approved survey plan') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('sp-1');
    expect(values).toContain('sp-2');
  });

  it('shows the empty-state message and no interactive control when no approved survey plans exist', () => {
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={[]} />);

    // Select's own empty-options branch (packages/ui/src/components/Form.tsx,
    // FE-10.2) replaces the interactive <select> entirely with a plain,
    // non-interactive <div> carrying the message — not a disabled <option>
    // inside a still-real <select>. This form passes no `emptyMessage` of
    // its own, only `placeholder` (used solely inside the <select> branch,
    // never rendered here), so Select's own default emptyMessage ("No
    // options available.") is what actually renders. Both were a
    // pre-existing, real test/behavior mismatch found and fixed in FE-10.8,
    // unrelated to this checkpoint's own change to the form.
    expect(screen.getByText('No options available.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Approved survey plan' })).not.toBeInTheDocument();
  });

  it('marks the survey plan select and required plot fields as required, use type/notes as optional', () => {
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    expect(screen.getByLabelText('Approved survey plan')).toBeRequired();
    expect(screen.getByLabelText('Plot number (plot 1)')).toBeRequired();
    expect(screen.getByLabelText('Area sqm (plot 1)')).toBeRequired();
    expect(screen.getByLabelText('Use type (plot 1)')).not.toBeRequired();
    expect(screen.getByLabelText('Notes (plot 1)')).not.toBeRequired();
  });

  it('adds and removes plot rows, disabling Remove when only one remains', async () => {
    const user = userEvent.setup();
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '+ Add plot' }));
    expect(screen.getByLabelText('Plot number (plot 2)')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).not.toBeDisabled();

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.queryByLabelText('Plot number (plot 2)')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled();
  });

  it('submits a single-plot subdivision with numeric areaSqm conversion and undefined useType/notes when blank', async () => {
    subdivideParcelMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Approved survey plan'), 'sp-1');
    await fillPlot(user, 1, 'PLT-001', '500');
    await user.click(screen.getByRole('button', { name: 'Subdivide parcel' }));

    expect(subdivideParcelMock).toHaveBeenCalledWith({
      parcelId: 'parcel-1',
      surveyPlanId: 'sp-1',
      plots: [{ plotNumber: 'PLT-001', areaSqm: 500, useType: undefined, notes: undefined }],
    });
  });

  it('submits a multi-plot subdivision including selected use type and notes', async () => {
    subdivideParcelMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Approved survey plan'), 'sp-2');
    await fillPlot(user, 1, 'PLT-001', '500');
    await user.selectOptions(screen.getByLabelText('Use type (plot 1)'), 'COMMERCIAL');
    await user.type(screen.getByLabelText('Notes (plot 1)'), 'Corner plot');
    await user.click(screen.getByRole('button', { name: '+ Add plot' }));
    await fillPlot(user, 2, 'PLT-002', '350');
    await user.click(screen.getByRole('button', { name: 'Subdivide parcel' }));

    expect(subdivideParcelMock).toHaveBeenCalledWith({
      parcelId: 'parcel-1',
      surveyPlanId: 'sp-2',
      plots: [
        { plotNumber: 'PLT-001', areaSqm: 500, useType: 'COMMERCIAL', notes: 'Corner plot' },
        { plotNumber: 'PLT-002', areaSqm: 350, useType: undefined, notes: undefined },
      ],
    });
  });

  it('shows the action-returned error message on failure', async () => {
    subdivideParcelMock.mockResolvedValue({ ok: false, error: 'Total plot area exceeds the parcel area' });
    const user = userEvent.setup();
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Approved survey plan'), 'sp-1');
    await fillPlot(user, 1, 'PLT-001', '99999');
    await user.click(screen.getByRole('button', { name: 'Subdivide parcel' }));

    expect(await screen.findByText('Total plot area exceeds the parcel area')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    subdivideParcelMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Approved survey plan'), 'sp-1');
    await fillPlot(user, 1, 'PLT-001', '500');
    await user.click(screen.getByRole('button', { name: 'Subdivide parcel' }));

    expect(await screen.findByText('Failed to subdivide parcel.')).toBeInTheDocument();
  });

  it('resets to the survey-plan placeholder and a single blank plot row after a successful submit', async () => {
    subdivideParcelMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Approved survey plan'), 'sp-1');
    await fillPlot(user, 1, 'PLT-001', '500');
    await user.click(screen.getByRole('button', { name: '+ Add plot' }));
    // Plot 2's fields are `required` too — leaving them blank would
    // block native form submission entirely (jsdom enforces HTML5
    // `required` the same way a real browser does), meaning
    // `handleSubmit` would never run and nothing would ever reset.
    // This test's own point is to verify the reset logic that runs
    // *after* a genuinely successful two-plot submission, so plot 2
    // needs to actually be filled in, same as plot 1.
    await fillPlot(user, 2, 'PLT-002', '300');
    await user.click(screen.getByRole('button', { name: 'Subdivide parcel' }));

    expect(await screen.findByLabelText('Approved survey plan')).toHaveValue('');
    expect(screen.getByLabelText('Plot number (plot 1)')).toHaveValue('');
    expect(screen.queryByLabelText('Plot number (plot 2)')).not.toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    subdivideParcelMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<SubdividePlotsForm parcelId="parcel-1" surveyPlanOptions={SURVEY_PLAN_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Approved survey plan'), 'sp-1');
    await fillPlot(user, 1, 'PLT-001', '500');
    await user.click(screen.getByRole('button', { name: 'Subdivide parcel' }));

    const pendingButton = screen.getByRole('button', { name: 'Subdividing…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Subdivide parcel' })).not.toBeDisabled();
  });
});
