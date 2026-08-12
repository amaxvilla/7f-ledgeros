import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createMortgageApplicationMock = vi.fn();
vi.mock('../actions', () => ({
  createMortgageApplication: (...args: unknown[]) => createMortgageApplicationMock(...args),
}));

import { CreateMortgageApplicationForm } from '../CreateMortgageApplicationForm';

beforeEach(() => {
  createMortgageApplicationMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Sale allocation ID'), 'allocation-1');
  await user.type(screen.getByLabelText('Lender'), 'Zenith Bank');
  await user.type(screen.getByLabelText('Amount applied'), '15000000');
}

describe('CreateMortgageApplicationForm', () => {
  it('renders every field with its label', () => {
    render(<CreateMortgageApplicationForm entityId="ent-1" />);

    expect(screen.getByLabelText('Sale allocation ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Lender')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount applied')).toBeInTheDocument();
    expect(screen.getByLabelText('Interest rate % (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tenor months (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add mortgage application' })).toBeInTheDocument();
  });

  it('marks only allocationId, lenderName, and amountApplied required', () => {
    render(<CreateMortgageApplicationForm entityId="ent-1" />);

    expect(screen.getByLabelText('Sale allocation ID')).toBeRequired();
    expect(screen.getByLabelText('Lender')).toBeRequired();
    expect(screen.getByLabelText('Amount applied')).toBeRequired();
    expect(screen.getByLabelText('Interest rate % (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Tenor months (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Notes (optional)')).not.toBeRequired();
  });

  it('omits optional fields and passes entityId through when left blank', async () => {
    createMortgageApplicationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMortgageApplicationForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add mortgage application' }));

    expect(createMortgageApplicationMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      allocationId: 'allocation-1',
      lenderName: 'Zenith Bank',
      amountApplied: 15000000,
      interestRatePercent: undefined,
      tenorMonths: undefined,
      notes: undefined,
    });
  });

  it('converts amountApplied/interestRatePercent/tenorMonths to numbers when provided', async () => {
    createMortgageApplicationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMortgageApplicationForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Interest rate % (optional)'), '18.5');
    await user.type(screen.getByLabelText('Tenor months (optional)'), '120');
    await user.click(screen.getByRole('button', { name: 'Add mortgage application' }));

    expect(createMortgageApplicationMock).toHaveBeenCalledWith(
      expect.objectContaining({ interestRatePercent: 18.5, tenorMonths: 120 }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createMortgageApplicationMock.mockResolvedValue({ ok: false, error: 'allocation is already financed' });
    const user = userEvent.setup();
    render(<CreateMortgageApplicationForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add mortgage application' }));

    expect(await screen.findByText('allocation is already financed')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createMortgageApplicationMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateMortgageApplicationForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Notes (optional)'), 'note');
    await user.click(screen.getByRole('button', { name: 'Add mortgage application' }));

    expect(await screen.findByLabelText('Sale allocation ID')).toHaveValue('');
    expect(screen.getByLabelText('Lender')).toHaveValue('');
    expect(screen.getByLabelText('Amount applied')).toHaveValue(null);
    expect(screen.getByLabelText('Notes (optional)')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createMortgageApplicationMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateMortgageApplicationForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add mortgage application' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add mortgage application' })).not.toBeDisabled();
  });
});
