import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const finalizeChecklistMock = vi.fn();
vi.mock('../actions', () => ({
  finalizeChecklist: (...args: unknown[]) => finalizeChecklistMock(...args),
}));

import { FinalizeChecklistButton } from '../FinalizeChecklistButton';

beforeEach(() => {
  finalizeChecklistMock.mockReset();
});

describe('FinalizeChecklistButton', () => {
  it('shows "Finalize" when result is not yet set', () => {
    render(<FinalizeChecklistButton id="chk-1" result={null} />);

    expect(screen.getByRole('button', { name: 'Finalize' })).toBeInTheDocument();
  });

  it('shows no button, just a dash, once a result already exists', () => {
    render(<FinalizeChecklistButton id="chk-1" result="PASS" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls finalizeChecklist with the id when clicked', async () => {
    finalizeChecklistMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<FinalizeChecklistButton id="chk-42" result={null} />);

    await user.click(screen.getByRole('button', { name: 'Finalize' }));

    expect(finalizeChecklistMock).toHaveBeenCalledWith('chk-42');
  });

  it('shows the action-returned error message on failure', async () => {
    finalizeChecklistMock.mockResolvedValue({ ok: false, error: '1 item(s) have not been assessed yet' });
    const user = userEvent.setup();
    render(<FinalizeChecklistButton id="chk-42" result={null} />);

    await user.click(screen.getByRole('button', { name: 'Finalize' }));

    expect(await screen.findByText('1 item(s) have not been assessed yet')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    finalizeChecklistMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<FinalizeChecklistButton id="chk-42" result={null} />);

    await user.click(screen.getByRole('button', { name: 'Finalize' }));

    expect(await screen.findByText('Failed to finalize checklist.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    finalizeChecklistMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<FinalizeChecklistButton id="chk-42" result={null} />);

    await user.click(screen.getByRole('button', { name: 'Finalize' }));
    expect(screen.getByRole('button', { name: 'Finalizing…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Finalize' })).not.toBeDisabled();
  });
});
