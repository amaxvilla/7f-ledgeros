import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createTaxCodeMock = vi.fn();
vi.mock('../actions', () => ({
  createTaxCode: (...args: unknown[]) => createTaxCodeMock(...args),
}));

import { CreateTaxCodeForm } from '../CreateTaxCodeForm';

beforeEach(() => {
  createTaxCodeMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Code'), 'WHT-10');
  await user.type(screen.getByLabelText('Name'), 'Withholding Tax 10%');
  await user.selectOptions(screen.getByLabelText('Tax type'), 'WHT');
  await user.type(screen.getByLabelText('Rate'), '0.1');
  await user.type(screen.getByLabelText('Tax authority GL account ID'), 'account-uuid-1');
}

describe('CreateTaxCodeForm', () => {
  it('renders every field with its label, and takes no entityId prop (shared reference data)', () => {
    render(<CreateTaxCodeForm />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Tax type')).toBeInTheDocument();
    expect(screen.getByLabelText('Rate')).toBeInTheDocument();
    expect(screen.getByLabelText('Jurisdiction (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tax authority GL account ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add tax code' })).toBeInTheDocument();
  });

  it('marks every field required except jurisdiction', () => {
    render(<CreateTaxCodeForm />);

    expect(screen.getByLabelText('Code')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Tax type')).toBeRequired();
    expect(screen.getByLabelText('Rate')).toBeRequired();
    expect(screen.getByLabelText('Jurisdiction (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Tax authority GL account ID')).toBeRequired();
  });

  it('converts rate to a number and omits jurisdiction when left blank', async () => {
    createTaxCodeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTaxCodeForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add tax code' }));

    expect(createTaxCodeMock).toHaveBeenCalledWith({
      code: 'WHT-10',
      name: 'Withholding Tax 10%',
      taxType: 'WHT',
      rate: 0.1,
      jurisdiction: undefined,
      taxAuthorityAccountId: 'account-uuid-1',
    });
  });

  it('includes jurisdiction when provided', async () => {
    createTaxCodeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTaxCodeForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Jurisdiction (optional)'), 'Lagos State');
    await user.click(screen.getByRole('button', { name: 'Add tax code' }));

    expect(createTaxCodeMock).toHaveBeenCalledWith(expect.objectContaining({ jurisdiction: 'Lagos State' }));
  });

  it('shows the action-returned error message on failure', async () => {
    createTaxCodeMock.mockResolvedValue({ ok: false, error: 'code must be unique' });
    const user = userEvent.setup();
    render(<CreateTaxCodeForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add tax code' }));

    expect(await screen.findByText('code must be unique')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createTaxCodeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateTaxCodeForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add tax code' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Tax type')).toHaveValue('');
    expect(screen.getByLabelText('Rate')).toHaveValue(null);
    expect(screen.getByLabelText('Tax authority GL account ID')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createTaxCodeMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateTaxCodeForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add tax code' }));

    const pendingButton = screen.getByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add tax code' })).not.toBeDisabled();
  });
});
