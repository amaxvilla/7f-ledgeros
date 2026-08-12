import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateEntityMock = vi.fn();
vi.mock('../actions', () => ({
  updateEntity: (...args: unknown[]) => updateEntityMock(...args),
}));

import { EditEntityForm } from '../EditEntityForm';

// Deliberately does NOT include 'ent-self' — page.tsx is what filters
// the entity's own id out before this component ever sees the list;
// this fixture reflects what the component actually receives.
const PARENT_OPTIONS = [{ value: 'ent-parent', label: '7FC — 7F Construction' }];

const INITIAL_VALUES = {
  code: '7FIL',
  name: '7F Industries Ltd',
  legalName: '7F Industries Limited',
  taxIdentificationNumber: 'TIN-001',
  registrationNumber: 'RC-001',
  baseCurrency: 'NGN',
  fiscalYearStartMonth: '1',
  parentEntityId: 'ent-parent',
  isConsolidationParent: false,
};

beforeEach(() => {
  updateEntityMock.mockReset();
});

describe('EditEntityForm', () => {
  it('pre-fills every field from initialValues', () => {
    render(<EditEntityForm entityId="ent-self" initialValues={INITIAL_VALUES} parentOptions={PARENT_OPTIONS} />);

    expect(screen.getByLabelText('Code')).toHaveValue('7FIL');
    expect(screen.getByLabelText('Name')).toHaveValue('7F Industries Ltd');
    expect(screen.getByLabelText('Legal name')).toHaveValue('7F Industries Limited');
    expect(screen.getByLabelText('Tax ID (optional)')).toHaveValue('TIN-001');
    expect(screen.getByLabelText('Registration number (optional)')).toHaveValue('RC-001');
    expect(screen.getByLabelText('Base currency (optional)')).toHaveValue('NGN');
    expect(screen.getByLabelText('Fiscal year start month (optional)')).toHaveValue(1);
    expect(screen.getByLabelText('Parent entity (optional)')).toHaveValue('ent-parent');
    expect(screen.getByLabelText('Consolidation parent')).toHaveValue('false');
  });

  it('marks Code/Name/Legal name as required, the rest optional', () => {
    render(<EditEntityForm entityId="ent-self" initialValues={INITIAL_VALUES} parentOptions={PARENT_OPTIONS} />);

    expect(screen.getByLabelText('Code')).toBeRequired();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Legal name')).toBeRequired();
    expect(screen.getByLabelText('Tax ID (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Parent entity (optional)')).not.toBeRequired();
  });

  it('submits the current (unedited) values verbatim, converting fiscalYearStartMonth to a number', async () => {
    updateEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditEntityForm entityId="ent-self" initialValues={INITIAL_VALUES} parentOptions={PARENT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateEntityMock).toHaveBeenCalledWith('ent-self', {
      code: '7FIL',
      name: '7F Industries Ltd',
      legalName: '7F Industries Limited',
      taxIdentificationNumber: 'TIN-001',
      registrationNumber: 'RC-001',
      baseCurrency: 'NGN',
      fiscalYearStartMonth: 1,
      parentEntityId: 'ent-parent',
      isConsolidationParent: false,
    });
  });

  it('submits edited values, with optional fields cleared to undefined when emptied', async () => {
    updateEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditEntityForm entityId="ent-self" initialValues={INITIAL_VALUES} parentOptions={PARENT_OPTIONS} />);

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), '7F Industries Limited Group');
    await user.clear(screen.getByLabelText('Tax ID (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateEntityMock).toHaveBeenCalledWith(
      'ent-self',
      expect.objectContaining({ name: '7F Industries Limited Group', taxIdentificationNumber: undefined }),
    );
  });

  it('shows "Saved." and does NOT reset any field after a successful save', async () => {
    updateEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditEntityForm entityId="ent-self" initialValues={INITIAL_VALUES} parentOptions={PARENT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveValue('7FIL');
    expect(screen.getByLabelText('Name')).toHaveValue('7F Industries Ltd');
  });

  it('shows the action-returned error message on failure, without a "Saved." message', async () => {
    updateEntityMock.mockResolvedValue({ ok: false, error: 'Entity code "7FIL" is already in use' });
    const user = userEvent.setup();
    render(<EditEntityForm entityId="ent-self" initialValues={INITIAL_VALUES} parentOptions={PARENT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Entity code "7FIL" is already in use')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    updateEntityMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<EditEntityForm entityId="ent-self" initialValues={INITIAL_VALUES} parentOptions={PARENT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Failed to save entity.')).toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    updateEntityMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<EditEntityForm entityId="ent-self" initialValues={INITIAL_VALUES} parentOptions={PARENT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const pendingButton = screen.getByRole('button', { name: 'Saving…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Save changes' })).not.toBeDisabled();
  });
});
