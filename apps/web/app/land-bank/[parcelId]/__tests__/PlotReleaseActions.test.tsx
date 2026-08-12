import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const releasePlotMock = vi.fn();
const cancelPlotReleaseMock = vi.fn();
vi.mock('../actions', () => ({
  releasePlot: (...args: unknown[]) => releasePlotMock(...args),
  cancelPlotRelease: (...args: unknown[]) => cancelPlotReleaseMock(...args),
}));

import { PlotReleaseActions } from '../PlotReleaseActions';

const PROJECT_OPTIONS = [
  { value: 'proj-1', label: 'PRJ-001 — Riverside Estate' },
  { value: 'proj-2', label: 'PRJ-002 — Hillcrest Gardens' },
];

beforeEach(() => {
  releasePlotMock.mockReset();
  cancelPlotReleaseMock.mockReset();
});

describe('PlotReleaseActions — visibility', () => {
  it('shows the release form (Project select + Release button) for an AVAILABLE plot with no release', () => {
    render(<PlotReleaseActions plotId="plot-1" status="AVAILABLE" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={null} />);

    expect(screen.getByLabelText('Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release' })).toBeInTheDocument();
  });

  it('populates the Project select from projectOptions', () => {
    render(<PlotReleaseActions plotId="plot-1" status="AVAILABLE" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={null} />);

    expect(screen.getByRole('option', { name: 'PRJ-001 — Riverside Estate' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PRJ-002 — Hillcrest Gardens' })).toBeInTheDocument();
  });

  it('shows the released-to-project note and Cancel form for an ALLOCATED plot with an active release', () => {
    render(
      <PlotReleaseActions
        plotId="plot-1"
        status="ALLOCATED"
        parcelId="parcel-1"
        projectOptions={PROJECT_OPTIONS}
        release={{ projectId: 'proj-1', releaseDate: '2026-07-01', notes: null }}
      />,
    );

    expect(screen.getByText('Released to project proj-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Cancellation reason')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel release' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument();
  });

  it.each(['PLANNED', 'RESERVED', 'SOLD'])('renders nothing for a %s plot', (status) => {
    const { container } = render(
      <PlotReleaseActions plotId="plot-1" status={status} parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('PlotReleaseActions — Release', () => {
  it('marks the Project select as required', () => {
    render(<PlotReleaseActions plotId="plot-1" status="AVAILABLE" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={null} />);

    expect(screen.getByLabelText('Project')).toBeRequired();
  });

  it('calls releasePlot with (plotId, { projectId, notes: undefined }, parcelId) when notes is left blank', async () => {
    releasePlotMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="AVAILABLE" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={null} />);

    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
    await user.click(screen.getByRole('button', { name: 'Release' }));

    expect(releasePlotMock).toHaveBeenCalledWith('plot-1', { projectId: 'proj-1', notes: undefined }, 'parcel-1');
  });

  it('shows the action-returned error message on Release failure', async () => {
    releasePlotMock.mockResolvedValue({ ok: false, error: 'Only an AVAILABLE plot can be released to a project' });
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="AVAILABLE" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={null} />);

    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
    await user.click(screen.getByRole('button', { name: 'Release' }));

    expect(await screen.findByText('Only an AVAILABLE plot can be released to a project')).toBeInTheDocument();
  });

  it('falls back to a generic error message when Release fails without one', async () => {
    releasePlotMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="AVAILABLE" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={null} />);

    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
    await user.click(screen.getByRole('button', { name: 'Release' }));

    expect(await screen.findByText('Failed to release plot.')).toBeInTheDocument();
  });

  it('disables the Release button and shows the pending label while releasing', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    releasePlotMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="AVAILABLE" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={null} />);

    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
    await user.click(screen.getByRole('button', { name: 'Release' }));
    expect(screen.getByRole('button', { name: 'Releasing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Release' })).not.toBeDisabled();
  });
});

describe('PlotReleaseActions — Cancel release', () => {
  const activeRelease = { projectId: 'proj-1', releaseDate: '2026-07-01', notes: null };

  it('marks the cancellation reason as required', () => {
    render(<PlotReleaseActions plotId="plot-1" status="ALLOCATED" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={activeRelease} />);

    expect(screen.getByLabelText('Cancellation reason')).toBeRequired();
  });

  it('calls cancelPlotRelease with (plotId, reason, parcelId)', async () => {
    cancelPlotReleaseMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="ALLOCATED" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={activeRelease} />);

    await user.type(screen.getByLabelText('Cancellation reason'), 'Project cancelled');
    await user.click(screen.getByRole('button', { name: 'Cancel release' }));

    expect(cancelPlotReleaseMock).toHaveBeenCalledWith('plot-1', 'Project cancelled', 'parcel-1');
  });

  it('shows the action-returned error message on Cancel failure', async () => {
    cancelPlotReleaseMock.mockResolvedValue({ ok: false, error: 'No active release found for this plot' });
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="ALLOCATED" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={activeRelease} />);

    await user.type(screen.getByLabelText('Cancellation reason'), 'Project cancelled');
    await user.click(screen.getByRole('button', { name: 'Cancel release' }));

    expect(await screen.findByText('No active release found for this plot')).toBeInTheDocument();
  });

  it('falls back to a generic error message when Cancel fails without one', async () => {
    cancelPlotReleaseMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="ALLOCATED" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={activeRelease} />);

    await user.type(screen.getByLabelText('Cancellation reason'), 'Project cancelled');
    await user.click(screen.getByRole('button', { name: 'Cancel release' }));

    expect(await screen.findByText('Failed to cancel plot release.')).toBeInTheDocument();
  });

  it('resets the reason field after a successful cancel', async () => {
    cancelPlotReleaseMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="ALLOCATED" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={activeRelease} />);

    await user.type(screen.getByLabelText('Cancellation reason'), 'Project cancelled');
    await user.click(screen.getByRole('button', { name: 'Cancel release' }));

    expect(await screen.findByLabelText('Cancellation reason')).toHaveValue('');
  });

  it('disables the Cancel release button and shows the pending label while cancelling', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    cancelPlotReleaseMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<PlotReleaseActions plotId="plot-1" status="ALLOCATED" parcelId="parcel-1" projectOptions={PROJECT_OPTIONS} release={activeRelease} />);

    await user.type(screen.getByLabelText('Cancellation reason'), 'Project cancelled');
    await user.click(screen.getByRole('button', { name: 'Cancel release' }));
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Cancel release' })).not.toBeDisabled();
  });
});
