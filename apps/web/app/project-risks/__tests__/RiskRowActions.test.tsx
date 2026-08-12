import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const assignRiskOwnerMock = vi.fn();
const convertRiskToIssueMock = vi.fn();
vi.mock('../actions', () => ({
  assignRiskOwner: (...args: unknown[]) => assignRiskOwnerMock(...args),
  convertRiskToIssue: (...args: unknown[]) => convertRiskToIssueMock(...args),
}));

import { RiskRowActions } from '../RiskRowActions';

beforeEach(() => {
  assignRiskOwnerMock.mockReset();
  convertRiskToIssueMock.mockReset();
});

describe('RiskRowActions — visibility', () => {
  it('shows Assign owner and Convert to issue for an IDENTIFIED risk', () => {
    render(<RiskRowActions id="risk-1" status="IDENTIFIED" />);

    expect(screen.getByRole('button', { name: 'Assign owner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convert to issue' })).toBeInTheDocument();
  });

  it('keeps both actions for a MONITORING risk (no sequencing restriction)', () => {
    render(<RiskRowActions id="risk-1" status="MONITORING" />);

    expect(screen.getByRole('button', { name: 'Assign owner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convert to issue' })).toBeInTheDocument();
  });

  it('renders nothing for an already-CLOSED risk', () => {
    const { container } = render(<RiskRowActions id="risk-1" status="CLOSED" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('RiskRowActions — assign owner', () => {
  it('calls assignRiskOwner with the risk id and typed user id on submit', async () => {
    assignRiskOwnerMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Assign owner (user id)'), 'user-9');
    await user.click(screen.getByRole('button', { name: 'Assign owner' }));

    expect(assignRiskOwnerMock).toHaveBeenCalledWith('risk-42', 'user-9');
  });

  it('clears the input after a successful assign', async () => {
    assignRiskOwnerMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Assign owner (user id)'), 'user-9');
    await user.click(screen.getByRole('button', { name: 'Assign owner' }));

    expect(await screen.findByLabelText('Assign owner (user id)')).toHaveValue('');
  });

  it('shows the action-returned error message when assign fails', async () => {
    assignRiskOwnerMock.mockResolvedValue({ ok: false, error: 'This risk is already CLOSED' });
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Assign owner (user id)'), 'user-9');
    await user.click(screen.getByRole('button', { name: 'Assign owner' }));

    expect(await screen.findByText('This risk is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when assign fails without one', async () => {
    assignRiskOwnerMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Assign owner (user id)'), 'user-9');
    await user.click(screen.getByRole('button', { name: 'Assign owner' }));

    expect(await screen.findByText('Failed to assign risk owner.')).toBeInTheDocument();
  });

  it('disables the Assign owner button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    assignRiskOwnerMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.type(screen.getByLabelText('Assign owner (user id)'), 'user-9');
    await user.click(screen.getByRole('button', { name: 'Assign owner' }));
    expect(screen.getByRole('button', { name: 'Assigning…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Assign owner' })).not.toBeDisabled();
  });
});

describe('RiskRowActions — convert to issue', () => {
  it('calls convertRiskToIssue with the risk id and no other arguments when clicked', async () => {
    convertRiskToIssueMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Convert to issue' }));

    expect(convertRiskToIssueMock).toHaveBeenCalledWith('risk-42');
  });

  it('shows the action-returned error message when convert fails', async () => {
    convertRiskToIssueMock.mockResolvedValue({ ok: false, error: 'This risk is already CLOSED' });
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Convert to issue' }));

    expect(await screen.findByText('This risk is already CLOSED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when convert fails without one', async () => {
    convertRiskToIssueMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Convert to issue' }));

    expect(await screen.findByText('Failed to convert risk to issue.')).toBeInTheDocument();
  });

  it('disables the Convert to issue button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    convertRiskToIssueMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RiskRowActions id="risk-42" status="IDENTIFIED" />);

    await user.click(screen.getByRole('button', { name: 'Convert to issue' }));
    expect(screen.getByRole('button', { name: 'Converting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Convert to issue' })).not.toBeDisabled();
  });
});
