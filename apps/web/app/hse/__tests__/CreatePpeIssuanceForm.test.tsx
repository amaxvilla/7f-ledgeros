import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const issuePpeMock = vi.fn();
vi.mock('../actions', () => ({
  issuePpe: (...args: unknown[]) => issuePpeMock(...args),
}));

import { CreatePpeIssuanceForm } from '../CreatePpeIssuanceForm';

beforeEach(() => {
  issuePpeMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Employee ID'), 'emp-1');
  await user.type(screen.getByLabelText('Item'), 'Safety helmet');
  await user.type(screen.getByLabelText('Quantity'), '2');
  await user.type(screen.getByLabelText('Issued date'), '2026-08-01');
}

describe('CreatePpeIssuanceForm', () => {
  it('renders every field', () => {
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    expect(screen.getByLabelText('Employee ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Item')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Issued date')).toBeInTheDocument();
    expect(screen.getByLabelText('Expiry date (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Issue PPE' })).toBeInTheDocument();
  });

  it('marks Expiry date as not required, and the rest as required', () => {
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    expect(screen.getByLabelText('Expiry date (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Employee ID')).toBeRequired();
    expect(screen.getByLabelText('Item')).toBeRequired();
    expect(screen.getByLabelText('Quantity')).toBeRequired();
    expect(screen.getByLabelText('Issued date')).toBeRequired();
  });

  it('submits entityId (from props, not a field) plus all required fields, with expiryDate omitted when blank', async () => {
    issuePpeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Issue PPE' }));

    expect(issuePpeMock).toHaveBeenCalledWith({
      entityId: 'entity-1',
      employeeId: 'emp-1',
      itemName: 'Safety helmet',
      quantity: 2,
      issuedDate: '2026-08-01',
      expiryDate: undefined,
    });
  });

  it('sends quantity as a number, not a string', async () => {
    issuePpeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Issue PPE' }));

    const call = issuePpeMock.mock.calls[0][0];
    expect(call.quantity).toBe(2);
    expect(typeof call.quantity).toBe('number');
  });

  it('includes expiryDate when filled in', async () => {
    issuePpeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Expiry date (optional)'), '2027-08-01');
    await user.click(screen.getByRole('button', { name: 'Issue PPE' }));

    const call = issuePpeMock.mock.calls[0][0];
    expect(call.expiryDate).toBe('2027-08-01');
  });

  it('clears the form on success', async () => {
    issuePpeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Issue PPE' }));

    expect(screen.getByLabelText('Employee ID')).toHaveValue('');
    expect(screen.getByLabelText('Item')).toHaveValue('');
    expect(screen.getByLabelText('Quantity')).toHaveValue(null);
  });

  it('shows the server error and keeps field values on failure', async () => {
    issuePpeMock.mockResolvedValue({ ok: false, error: 'Quantity must be positive' });
    const user = userEvent.setup();
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Issue PPE' }));

    expect(await screen.findByText('Quantity must be positive')).toBeInTheDocument();
    expect(screen.getByLabelText('Employee ID')).toHaveValue('emp-1');
  });

  it('shows a generic error message when the failure has none', async () => {
    issuePpeMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Issue PPE' }));

    expect(await screen.findByText('Failed to issue PPE.')).toBeInTheDocument();
  });

  it('disables the submit button and shows pending text while submitting', async () => {
    let resolvePromise: (value: { ok: boolean }) => void;
    issuePpeMock.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));
    const user = userEvent.setup();
    render(<CreatePpeIssuanceForm entityId="entity-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Issue PPE' }));

    expect(screen.getByRole('button', { name: 'Issuing…' })).toBeDisabled();
    resolvePromise!({ ok: true });
  });
});
