import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const triggerReportGenerationMock = vi.fn();
vi.mock('../actions', () => ({
  triggerReportGeneration: (...args: unknown[]) => triggerReportGenerationMock(...args),
}));

import { TriggerReportGenerationForm } from '../TriggerReportGenerationForm';

beforeEach(() => {
  triggerReportGenerationMock.mockReset();
});

describe('TriggerReportGenerationForm', () => {
  it('renders every field, defaulting report to Budget vs Actual and format to CSV', () => {
    render(<TriggerReportGenerationForm />);

    expect(screen.getByLabelText('Report')).toHaveValue('budget-vs-actual');
    expect(screen.getByLabelText('Format')).toHaveValue('csv');
    expect(screen.getByLabelText('Entity ID')).toBeRequired();
    expect(screen.getByLabelText('Fiscal year (optional)')).not.toBeRequired();
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeInTheDocument();
  });

  it('submits with fiscalYear omitted (undefined, not an empty string) when left blank', async () => {
    triggerReportGenerationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerReportGenerationForm />);

    await user.type(screen.getByLabelText('Entity ID'), 'ent-1');
    await user.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(triggerReportGenerationMock).toHaveBeenCalledWith({
      reportKey: 'budget-vs-actual',
      entityId: 'ent-1',
      fiscalYear: undefined,
      format: 'csv',
    });
  });

  it('submits the selected report, entity, fiscal year, and format', async () => {
    triggerReportGenerationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerReportGenerationForm />);

    await user.selectOptions(screen.getByLabelText('Report'), 'vendor-aging');
    await user.type(screen.getByLabelText('Entity ID'), 'ent-1');
    await user.type(screen.getByLabelText('Fiscal year (optional)'), '2026');
    await user.selectOptions(screen.getByLabelText('Format'), 'json');
    await user.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(triggerReportGenerationMock).toHaveBeenCalledWith({
      reportKey: 'vendor-aging',
      entityId: 'ent-1',
      fiscalYear: 2026,
      format: 'json',
    });
  });

  it('shows a confirmation message on success', async () => {
    triggerReportGenerationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerReportGenerationForm />);

    await user.type(screen.getByLabelText('Entity ID'), 'ent-1');
    await user.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByText('Queued — check the table below once it completes.')).toBeInTheDocument();
  });

  it('shows the returned error message on failure', async () => {
    triggerReportGenerationMock.mockResolvedValue({ ok: false, error: 'Entity not found' });
    const user = userEvent.setup();
    render(<TriggerReportGenerationForm />);

    await user.type(screen.getByLabelText('Entity ID'), 'bad-id');
    await user.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByText('Entity not found')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    triggerReportGenerationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TriggerReportGenerationForm />);

    await user.type(screen.getByLabelText('Entity ID'), 'ent-1');
    await user.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(screen.getByRole('button', { name: 'Queuing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Generate report' })).not.toBeDisabled();
  });
});
