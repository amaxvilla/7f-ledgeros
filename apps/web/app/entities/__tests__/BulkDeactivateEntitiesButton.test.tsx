import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@7f/ui';

const deactivateEntityMock = vi.fn();
vi.mock('../actions', () => ({
  deactivateEntity: (...args: unknown[]) => deactivateEntityMock(...args),
}));

import { BulkDeactivateEntitiesButton } from '../BulkDeactivateEntitiesButton';

beforeEach(() => {
  deactivateEntityMock.mockReset();
});

describe('BulkDeactivateEntitiesButton — visibility', () => {
  it('shows a count-labeled button when at least one selected entity is active', () => {
    render(<BulkDeactivateEntitiesButton entities={[{ id: 'e1', isActive: true }, { id: 'e2', isActive: false }]} onDone={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Deactivate 1 selected' })).toBeInTheDocument();
  });

  it('shows a message with no button when every selected entity is already inactive', () => {
    render(<BulkDeactivateEntitiesButton entities={[{ id: 'e1', isActive: false }, { id: 'e2', isActive: false }]} onDone={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Selected entities are already inactive.')).toBeInTheDocument();
  });
});

describe('BulkDeactivateEntitiesButton — deactivate', () => {
  it('calls deactivateEntity once per active entity, skipping already-inactive ones', async () => {
    deactivateEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <BulkDeactivateEntitiesButton
        entities={[{ id: 'e1', isActive: true }, { id: 'e2', isActive: false }, { id: 'e3', isActive: true }]}
        onDone={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Deactivate 2 selected' }));

    expect(deactivateEntityMock).toHaveBeenCalledTimes(2);
    expect(deactivateEntityMock).toHaveBeenCalledWith('e1');
    expect(deactivateEntityMock).toHaveBeenCalledWith('e3');
  });

  it('calls onDone after finishing, on success', async () => {
    deactivateEntityMock.mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<BulkDeactivateEntitiesButton entities={[{ id: 'e1', isActive: true }]} onDone={onDone} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate 1 selected' }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone even when some deactivations fail', async () => {
    deactivateEntityMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: 'boom' });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<BulkDeactivateEntitiesButton entities={[{ id: 'e1', isActive: true }, { id: 'e2', isActive: true }]} onDone={onDone} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate 2 selected' }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows a success toast reporting the deactivated count', async () => {
    deactivateEntityMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <BulkDeactivateEntitiesButton entities={[{ id: 'e1', isActive: true }, { id: 'e2', isActive: true }]} onDone={vi.fn()} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Deactivate 2 selected' }));

    expect(await screen.findByText('2 entities deactivated.')).toBeInTheDocument();
  });

  it('shows a mixed-result toast when some deactivations fail', async () => {
    deactivateEntityMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <BulkDeactivateEntitiesButton entities={[{ id: 'e1', isActive: true }, { id: 'e2', isActive: true }]} onDone={vi.fn()} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Deactivate 2 selected' }));

    expect(await screen.findByText('1 deactivated, 1 failed.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveFirst: (value: { ok: boolean }) => void = () => {};
    deactivateEntityMock.mockReturnValue(new Promise((resolve) => (resolveFirst = resolve)));
    const user = userEvent.setup();
    render(<BulkDeactivateEntitiesButton entities={[{ id: 'e1', isActive: true }]} onDone={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Deactivate 1 selected' }));
    expect(screen.getByRole('button', { name: 'Deactivating…' })).toBeDisabled();

    resolveFirst({ ok: true });
    expect(await screen.findByRole('button', { name: 'Deactivate 1 selected' })).not.toBeDisabled();
  });
});
