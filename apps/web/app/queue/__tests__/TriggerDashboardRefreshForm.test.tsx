import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const triggerDashboardRefreshMock = vi.fn();
vi.mock('../actions', () => ({
  triggerDashboardRefresh: (...args: unknown[]) => triggerDashboardRefreshMock(...args),
}));

import { TriggerDashboardRefreshForm } from '../TriggerDashboardRefreshForm';

beforeEach(() => {
  triggerDashboardRefreshMock.mockReset();
});

describe('TriggerDashboardRefreshForm', () => {
  it('renders the optional entity field and submit button', () => {
    render(<TriggerDashboardRefreshForm />);

    expect(screen.getByLabelText('Entity ID (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trigger dashboard refresh' })).toBeInTheDocument();
  });

  it('submits undefined when the entity field is left blank', async () => {
    triggerDashboardRefreshMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerDashboardRefreshForm />);

    await user.click(screen.getByRole('button', { name: 'Trigger dashboard refresh' }));

    expect(triggerDashboardRefreshMock).toHaveBeenCalledWith(undefined);
  });

  it('submits the entered entity ID', async () => {
    triggerDashboardRefreshMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerDashboardRefreshForm />);

    await user.type(screen.getByLabelText('Entity ID (optional)'), 'ent-1');
    await user.click(screen.getByRole('button', { name: 'Trigger dashboard refresh' }));

    expect(triggerDashboardRefreshMock).toHaveBeenCalledWith('ent-1');
  });

  it('shows a confirmation message on success', async () => {
    triggerDashboardRefreshMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TriggerDashboardRefreshForm />);

    await user.click(screen.getByRole('button', { name: 'Trigger dashboard refresh' }));

    expect(await screen.findByText('Queued.')).toBeInTheDocument();
  });

  it('shows the returned error message on failure', async () => {
    triggerDashboardRefreshMock.mockResolvedValue({ ok: false, error: 'Queue unavailable' });
    const user = userEvent.setup();
    render(<TriggerDashboardRefreshForm />);

    await user.click(screen.getByRole('button', { name: 'Trigger dashboard refresh' }));

    expect(await screen.findByText('Queue unavailable')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    triggerDashboardRefreshMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TriggerDashboardRefreshForm />);

    await user.click(screen.getByRole('button', { name: 'Trigger dashboard refresh' }));

    expect(screen.getByRole('button', { name: 'Queuing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Trigger dashboard refresh' })).not.toBeDisabled();
  });
});
