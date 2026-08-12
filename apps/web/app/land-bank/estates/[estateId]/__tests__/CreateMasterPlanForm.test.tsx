import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createMasterPlanMock = vi.fn();
vi.mock('../actions', () => ({
  createMasterPlan: (...args: unknown[]) => createMasterPlanMock(...args),
}));

import { CreateMasterPlanForm } from '../CreateMasterPlanForm';

beforeEach(() => {
  createMasterPlanMock.mockReset();
});

describe('CreateMasterPlanForm — rendering', () => {
  it('renders Summary and Total planned units fields, and zero zone rows by default', () => {
    render(<CreateMasterPlanForm estateId="estate-1" />);

    expect(screen.getByLabelText('Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Total planned units')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code (zone 1)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add zone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create master plan' })).toBeInTheDocument();
  });

  it('marks Summary and Total planned units as optional', () => {
    render(<CreateMasterPlanForm estateId="estate-1" />);

    expect(screen.getByLabelText('Summary')).not.toBeRequired();
    expect(screen.getByLabelText('Total planned units')).not.toBeRequired();
  });

  it('adds a zone row with required Code/Name/Use type and optional area/unit fields', async () => {
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: '+ Add zone' }));

    expect(screen.getByLabelText('Code (zone 1)')).toBeRequired();
    expect(screen.getByLabelText('Name (zone 1)')).toBeRequired();
    expect(screen.getByLabelText('Use type (zone 1)')).toBeRequired();
    expect(screen.getByLabelText('Planned area sqm (zone 1)')).not.toBeRequired();
    expect(screen.getByLabelText('Planned unit count (zone 1)')).not.toBeRequired();
  });

  it('adds a second zone row on a second click, each independently addressable', async () => {
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: '+ Add zone' }));
    await user.click(screen.getByRole('button', { name: '+ Add zone' }));

    expect(screen.getByLabelText('Code (zone 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Code (zone 2)')).toBeInTheDocument();
  });

  it('removes a zone row, with no minimum-row floor (down to zero is allowed)', async () => {
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: '+ Add zone' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByLabelText('Code (zone 1)')).not.toBeInTheDocument();
  });
});

describe('CreateMasterPlanForm — submit', () => {
  it('submits with no zones when none were added', async () => {
    createMasterPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.type(screen.getByLabelText('Summary'), 'Phase 1 master plan');
    await user.click(screen.getByRole('button', { name: 'Create master plan' }));

    expect(createMasterPlanMock).toHaveBeenCalledWith({
      estateId: 'estate-1',
      summary: 'Phase 1 master plan',
      totalPlannedUnits: undefined,
      zones: undefined,
    });
  });

  it('submits entered zones with numeric fields converted, omitting empty optional numbers', async () => {
    createMasterPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: '+ Add zone' }));
    await user.type(screen.getByLabelText('Code (zone 1)'), 'ZN-A');
    await user.type(screen.getByLabelText('Name (zone 1)'), 'Residential Block A');
    await user.selectOptions(screen.getByLabelText('Use type (zone 1)'), 'RESIDENTIAL');
    await user.type(screen.getByLabelText('Planned area sqm (zone 1)'), '5000');

    await user.click(screen.getByRole('button', { name: 'Create master plan' }));

    expect(createMasterPlanMock).toHaveBeenCalledWith({
      estateId: 'estate-1',
      summary: undefined,
      totalPlannedUnits: undefined,
      zones: [{ code: 'ZN-A', name: 'Residential Block A', useType: 'RESIDENTIAL', plannedAreaSqm: 5000, plannedUnitCount: undefined }],
    });
  });

  it('converts totalPlannedUnits to a number when provided', async () => {
    createMasterPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.type(screen.getByLabelText('Total planned units'), '120');
    await user.click(screen.getByRole('button', { name: 'Create master plan' }));

    expect(createMasterPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ totalPlannedUnits: 120 }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createMasterPlanMock.mockResolvedValue({ ok: false, error: 'Estate not found' });
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: 'Create master plan' }));

    expect(await screen.findByText('Estate not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createMasterPlanMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: 'Create master plan' }));

    expect(await screen.findByText('Failed to create master plan.')).toBeInTheDocument();
  });

  it('resets Summary, Total planned units, and all zone rows after a successful submit', async () => {
    createMasterPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.type(screen.getByLabelText('Summary'), 'Phase 1');
    await user.click(screen.getByRole('button', { name: '+ Add zone' }));
    await user.type(screen.getByLabelText('Code (zone 1)'), 'ZN-A');
    await user.type(screen.getByLabelText('Name (zone 1)'), 'Residential Block A');
    await user.selectOptions(screen.getByLabelText('Use type (zone 1)'), 'RESIDENTIAL');

    await user.click(screen.getByRole('button', { name: 'Create master plan' }));

    expect(await screen.findByLabelText('Summary')).toHaveValue('');
    expect(screen.queryByLabelText('Code (zone 1)')).not.toBeInTheDocument();
  });

  it('does not reset the form on failure', async () => {
    createMasterPlanMock.mockResolvedValue({ ok: false, error: 'Estate not found' });
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.type(screen.getByLabelText('Summary'), 'Phase 1');
    await user.click(screen.getByRole('button', { name: 'Create master plan' }));

    await screen.findByText('Estate not found');
    expect(screen.getByLabelText('Summary')).toHaveValue('Phase 1');
  });

  it('disables the submit button and shows the pending label while submitting', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createMasterPlanMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateMasterPlanForm estateId="estate-1" />);

    await user.click(screen.getByRole('button', { name: 'Create master plan' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create master plan' })).not.toBeDisabled();
  });
});
