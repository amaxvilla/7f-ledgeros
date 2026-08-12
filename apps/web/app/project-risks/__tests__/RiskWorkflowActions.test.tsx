import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const assessRiskMock = vi.fn();
const setRiskMitigationPlanMock = vi.fn();
const monitorRiskMock = vi.fn();
vi.mock('../actions', () => ({
  assessRisk: (...args: unknown[]) => assessRiskMock(...args),
  setRiskMitigationPlan: (...args: unknown[]) => setRiskMitigationPlanMock(...args),
  monitorRisk: (...args: unknown[]) => monitorRiskMock(...args),
}));

import { RiskWorkflowActions } from '../RiskWorkflowActions';

beforeEach(() => {
  assessRiskMock.mockReset();
  setRiskMitigationPlanMock.mockReset();
  monitorRiskMock.mockReset();
});

describe('RiskWorkflowActions — visibility', () => {
  it('shows Assess, Set plan, and Start monitoring for an IDENTIFIED risk', () => {
    render(<RiskWorkflowActions id="risk-1" status="IDENTIFIED" />);

    expect(screen.getByRole('button', { name: 'Assess' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start monitoring' })).toBeInTheDocument();
  });

  it('keeps all three actions for a MONITORING risk (no per-status hiding beyond OCCURRED/CLOSED)', () => {
    render(<RiskWorkflowActions id="risk-1" status="MONITORING" />);

    expect(screen.getByRole('button', { name: 'Assess' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start monitoring' })).toBeInTheDocument();
  });

  it('renders nothing for an OCCURRED risk', () => {
    const { container } = render(<RiskWorkflowActions id="risk-1" status="OCCURRED" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an already-CLOSED risk', () => {
    const { container } = render(<RiskWorkflowActions id="risk-1" status="CLOSED" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('RiskWorkflowActions — assess', () => {
  it('calls assessRisk with the risk id and selected probability/impact on submit', async () => {
    assessRiskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.selectOptions(screen.getByLabelText('Probability'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Impact'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Assess' }));

    expect(assessRiskMock).toHaveBeenCalledWith('risk-42', { probability: 'HIGH', impact: 'MEDIUM' });
  });

  it('resets both Selects after a successful assess', async () => {
    assessRiskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.selectOptions(screen.getByLabelText('Probability'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Impact'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Assess' }));

    expect(await screen.findByLabelText('Probability')).toHaveValue('');
    expect(screen.getByLabelText('Impact')).toHaveValue('');
  });

  it('shows the action-returned error message when assess fails', async () => {
    assessRiskMock.mockResolvedValue({ ok: false, error: 'This risk is already CLOSED' });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.selectOptions(screen.getByLabelText('Probability'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Impact'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Assess' }));

    expect(await screen.findByText('This risk is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when assess fails without one', async () => {
    assessRiskMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.selectOptions(screen.getByLabelText('Probability'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Impact'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Assess' }));

    expect(await screen.findByText('Failed to assess risk.')).toBeInTheDocument();
  });

  it('disables the Assess button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    assessRiskMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.selectOptions(screen.getByLabelText('Probability'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Impact'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Assess' }));
    expect(screen.getByRole('button', { name: 'Assessing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Assess' })).not.toBeDisabled();
  });
});

describe('RiskWorkflowActions — set mitigation plan', () => {
  it('calls setRiskMitigationPlan with the risk id and typed plan text on submit', async () => {
    setRiskMitigationPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Mitigation plan'), 'Add a secondary supplier');
    await user.click(screen.getByRole('button', { name: 'Set plan' }));

    expect(setRiskMitigationPlanMock).toHaveBeenCalledWith('risk-42', 'Add a secondary supplier');
  });

  it('clears the input after a successful save', async () => {
    setRiskMitigationPlanMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Mitigation plan'), 'Add a secondary supplier');
    await user.click(screen.getByRole('button', { name: 'Set plan' }));

    expect(await screen.findByLabelText('Mitigation plan')).toHaveValue('');
  });

  it('shows the action-returned error message when saving the plan fails', async () => {
    setRiskMitigationPlanMock.mockResolvedValue({ ok: false, error: 'This risk is already CLOSED' });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Mitigation plan'), 'Add a secondary supplier');
    await user.click(screen.getByRole('button', { name: 'Set plan' }));

    expect(await screen.findByText('This risk is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when saving the plan fails without one', async () => {
    setRiskMitigationPlanMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Mitigation plan'), 'Add a secondary supplier');
    await user.click(screen.getByRole('button', { name: 'Set plan' }));

    expect(await screen.findByText('Failed to set mitigation plan.')).toBeInTheDocument();
  });

  it('disables the Set plan button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    setRiskMitigationPlanMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Mitigation plan'), 'Add a secondary supplier');
    await user.click(screen.getByRole('button', { name: 'Set plan' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Set plan' })).not.toBeDisabled();
  });
});

describe('RiskWorkflowActions — start monitoring', () => {
  it('calls monitorRisk with the risk id and no other arguments when clicked', async () => {
    monitorRiskMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Start monitoring' }));

    expect(monitorRiskMock).toHaveBeenCalledWith('risk-42');
  });

  it('shows the action-returned error message when monitor fails', async () => {
    monitorRiskMock.mockResolvedValue({ ok: false, error: 'This risk is already CLOSED' });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Start monitoring' }));

    expect(await screen.findByText('This risk is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when monitor fails without one', async () => {
    monitorRiskMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Start monitoring' }));

    expect(await screen.findByText('Failed to start monitoring risk.')).toBeInTheDocument();
  });

  it('disables the Start monitoring button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    monitorRiskMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RiskWorkflowActions id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Start monitoring' }));
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Start monitoring' })).not.toBeDisabled();
  });
});
