import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoutButton } from '../LogoutButton';

describe('LogoutButton', () => {
  it('calls onLogout when clicked, without a form "action" DOM attribute', async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LogoutButton onLogout={onLogout} />);

    const button = screen.getByRole('button', { name: 'Log out' });
    const form = button.closest('form') as HTMLFormElement;
    expect(form).toBeInTheDocument();
    // The whole point of this component is not depending on the
    // form-action DOM attribute (see this file's own doc comment on
    // the React 18-vs-19 caveat it replaces) — asserting its absence
    // here is a regression guard against reintroducing it.
    expect(form.getAttribute('action')).toBeNull();

    await user.click(button);

    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
  });

  it('does not navigate via native form submission (no full-page reload path)', async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LogoutButton onLogout={onLogout} />);

    const button = screen.getByRole('button', { name: 'Log out' });
    const form = button.closest('form') as HTMLFormElement;
    const submitSpy = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener('submit', submitSpy);

    await user.click(button);

    expect(submitSpy).toHaveBeenCalledTimes(1);
    const submitEvent = submitSpy.mock.calls[0][0];
    expect(submitEvent.defaultPrevented).toBe(true);
  });

  // De-duplication checkpoint — this is the exact gap ActionForm's own
  // doc comment says the original `useTransition`-based implementation
  // had: React 18 only tracks a transition callback's synchronous
  // portion as pending, so `isPending` had already flipped back to
  // `false` by the time this assertion could observe it. Reusing
  // ActionForm's `useState`-based tracking fixes it; this test is the
  // regression guard proving that, not present before this checkpoint.
  it('disables the button while onLogout is still in flight', async () => {
    let resolveLogout: () => void = () => {};
    const onLogout = vi.fn().mockReturnValue(new Promise<void>((resolve) => (resolveLogout = resolve)));
    const user = userEvent.setup();
    render(<LogoutButton onLogout={onLogout} />);

    const button = screen.getByRole('button', { name: 'Log out' });
    await user.click(button);

    expect(button).toBeDisabled();

    resolveLogout();
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
