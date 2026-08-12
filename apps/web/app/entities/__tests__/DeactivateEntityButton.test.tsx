import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deactivateEntityMock = vi.fn();
vi.mock('../actions', () => ({
  deactivateEntity: (...args: unknown[]) => deactivateEntityMock(...args),
}));

import { DeactivateEntityButton } from '../DeactivateEntityButton';

beforeEach(() => {
  deactivateEntityMock.mockReset();
});

describe('DeactivateEntityButton — visibility', () => {
  it('shows a Deactivate button when the entity is active', () => {
    render(<DeactivateEntityButton id="ent-1" isActive={true} />);

    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it('shows only a dash, no button, when the entity is already inactive', () => {
    render(<DeactivateEntityButton id="ent-1" isActive={false} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('DeactivateEntityButton — deactivate', () => {
  it('calls deactivateEntity with the entity id when clicked', async () => {
    deactivateEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<DeactivateEntityButton id="ent-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(deactivateEntityMock).toHaveBeenCalledWith('ent-42');
  });

  it('shows the action-returned error message on failure', async () => {
    deactivateEntityMock.mockResolvedValue({ ok: false, error: 'Entity ent-42 not found' });
    const user = userEvent.setup();
    render(<DeactivateEntityButton id="ent-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Entity ent-42 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    deactivateEntityMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<DeactivateEntityButton id="ent-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Failed to deactivate entity.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    deactivateEntityMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<DeactivateEntityButton id="ent-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(screen.getByRole('button', { name: 'Deactivating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Deactivate' })).not.toBeDisabled();
  });

  it('re-enables the button after a failed attempt so the admin can retry', async () => {
    deactivateEntityMock.mockResolvedValue({ ok: false, error: 'Network error' });
    const user = userEvent.setup();
    render(<DeactivateEntityButton id="ent-42" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByRole('button', { name: 'Deactivate' })).not.toBeDisabled();
  });
});
