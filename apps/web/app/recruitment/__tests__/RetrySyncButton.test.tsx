import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const retryCalendarSyncMock = vi.fn();
const retryTeamsSyncMock = vi.fn();
const retryContactSyncMock = vi.fn();
const retrySignatureSyncMock = vi.fn();
vi.mock('../actions', () => ({
  retryCalendarSync: (...args: unknown[]) => retryCalendarSyncMock(...args),
  retryTeamsSync: (...args: unknown[]) => retryTeamsSyncMock(...args),
  retryContactSync: (...args: unknown[]) => retryContactSyncMock(...args),
  retrySignatureSync: (...args: unknown[]) => retrySignatureSyncMock(...args),
}));

import { RetrySyncButton } from '../RetrySyncButton';

beforeEach(() => {
  retryCalendarSyncMock.mockReset();
  retryTeamsSyncMock.mockReset();
  retryContactSyncMock.mockReset();
  retrySignatureSyncMock.mockReset();
});

describe('RetrySyncButton — routing to the right action per kind', () => {
  it.each([
    ['calendar', retryCalendarSyncMock] as const,
    ['teams', retryTeamsSyncMock] as const,
    ['contact', retryContactSyncMock] as const,
    ['signature', retrySignatureSyncMock] as const,
  ])('calls only the %s retry action, with the given id, when clicked', async (kind, mock) => {
    mock.mockResolvedValue({ ok: true });
    const others = [retryCalendarSyncMock, retryTeamsSyncMock, retryContactSyncMock, retrySignatureSyncMock].filter((m) => m !== mock);
    const user = userEvent.setup();

    render(<RetrySyncButton id="row-1" kind={kind} />);
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mock).toHaveBeenCalledWith('row-1');
    for (const other of others) {
      expect(other).not.toHaveBeenCalled();
    }
  });
});

describe('RetrySyncButton — pending and error states', () => {
  it('disables the button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    retryCalendarSyncMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RetrySyncButton id="row-1" kind="calendar" />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Retry' })).not.toBeDisabled();
  });

  it('shows the action-returned error message on failure (e.g. a repeat-failure ConflictException)', async () => {
    retryTeamsSyncMock.mockResolvedValue({ ok: false, error: 'Teams sync retry failed for interview row-1: still unreachable' });
    const user = userEvent.setup();
    render(<RetrySyncButton id="row-1" kind="teams" />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Teams sync retry failed for interview row-1: still unreachable')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    retryContactSyncMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RetrySyncButton id="row-1" kind="contact" />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Retry failed.')).toBeInTheDocument();
  });

  it('does not hide the button after a failed retry — the row stays actionable', async () => {
    retrySignatureSyncMock.mockResolvedValue({ ok: false, error: 'Signature sync retry failed' });
    const user = userEvent.setup();
    render(<RetrySyncButton id="row-1" kind="signature" />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Signature sync retry failed');

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).not.toBeDisabled();
  });
});
