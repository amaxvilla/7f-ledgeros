import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createEntityMock = vi.fn();
vi.mock('../actions', () => ({
  createEntity: (...args: unknown[]) => createEntityMock(...args),
}));

import { CreateEntityForm } from '../CreateEntityForm';

const PARENT_OPTIONS = [{ value: 'ent-1', label: '7FC — 7F Construction' }];

beforeEach(() => {
  createEntityMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Code'), '7FIL');
  await user.type(screen.getByLabelText('Name'), '7F Industries Ltd');
  await user.type(screen.getByLabelText('Legal name'), '7F Industries Limited');
}

describe('CreateEntityForm', () => {
  it('renders every field, defaulting Consolidation parent to No', () => {
    render(<CreateEntityForm parentOptions={PARENT_OPTIONS} />);

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Legal name')).toBeInTheDocument();
    expect(screen.getByLabelText('Tax ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Registration number (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Base currency (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Fiscal year start month (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Parent entity (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Consolidation parent')).toHaveValue('false');
  });

  it('marks Code/Name/Legal name as required, and the rest as not required', () => {
    render(<CreateEntityForm parentOptions={PARENT_OPTIONS} />);

    expect(screen.getByLabelText('Code')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Legal name')).toBeRequired();
    expect(screen.getByLabelText('Tax ID (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Registration number (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Base currency (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Fiscal year start month (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Parent entity (optional)')).not.toBeRequired();
  });

  it('submits the required fields, omitting every optional field as undefined when blank', async () => {
    createEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateEntityForm parentOptions={PARENT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add entity' }));

    expect(createEntityMock).toHaveBeenCalledWith({
      code: '7FIL',
      name: '7F Industries Ltd',
      legalName: '7F Industries Limited',
      taxIdentificationNumber: undefined,
      registrationNumber: undefined,
      baseCurrency: undefined,
      fiscalYearStartMonth: undefined,
      parentEntityId: undefined,
      isConsolidationParent: false,
    });
  });

  it('includes optional fields, with numeric conversion for fiscalYearStartMonth, when filled in', async () => {
    createEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateEntityForm parentOptions={PARENT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Tax ID (optional)'), 'TIN-1234');
    await user.type(screen.getByLabelText('Registration number (optional)'), 'RC-5678');
    await user.type(screen.getByLabelText('Base currency (optional)'), 'USD');
    await user.type(screen.getByLabelText('Fiscal year start month (optional)'), '4');
    await user.selectOptions(screen.getByLabelText('Parent entity (optional)'), 'ent-1');
    await user.selectOptions(screen.getByLabelText('Consolidation parent'), 'true');
    await user.click(screen.getByRole('button', { name: 'Add entity' }));

    expect(createEntityMock).toHaveBeenCalledWith({
      code: '7FIL',
      name: '7F Industries Ltd',
      legalName: '7F Industries Limited',
      taxIdentificationNumber: 'TIN-1234',
      registrationNumber: 'RC-5678',
      baseCurrency: 'USD',
      fiscalYearStartMonth: 4,
      parentEntityId: 'ent-1',
      isConsolidationParent: true,
    });
  });

  it('shows the action-returned error message and does not reset the fields on failure', async () => {
    createEntityMock.mockResolvedValue({ ok: false, error: 'Entity code "7FIL" is already in use' });
    const user = userEvent.setup();
    render(<CreateEntityForm parentOptions={PARENT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add entity' }));

    expect(await screen.findByText('Entity code "7FIL" is already in use')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveValue('7FIL');
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createEntityMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateEntityForm parentOptions={PARENT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add entity' }));

    expect(await screen.findByText('Failed to create entity.')).toBeInTheDocument();
  });

  it('resets every field after a successful submit', async () => {
    createEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateEntityForm parentOptions={PARENT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Base currency (optional)'), 'USD');
    await user.selectOptions(screen.getByLabelText('Consolidation parent'), 'true');
    await user.click(screen.getByRole('button', { name: 'Add entity' }));

    expect(await screen.findByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Legal name')).toHaveValue('');
    expect(screen.getByLabelText('Base currency (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Consolidation parent')).toHaveValue('false');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createEntityMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateEntityForm parentOptions={PARENT_OPTIONS} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add entity' }));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Add entity' })).not.toBeDisabled();
  });
});
