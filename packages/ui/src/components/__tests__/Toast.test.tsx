import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastProvider, useToast } from '../Toast';

function TriggerButton({ message, tone }: { message: string; tone?: 'positive' | 'negative' | 'neutral' }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(message, tone)}>
      Trigger
    </button>
  );
}

describe('useToast without a ToastProvider', () => {
  it('returns a no-op showToast rather than throwing', async () => {
    const user = userEvent.setup();
    render(<TriggerButton message="Hello" />);

    // Should not throw when clicked with no provider mounted.
    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });
});

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a toast when showToast is called', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TriggerButton message="Saved successfully" tone="positive" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(await screen.findByText('Saved successfully')).toBeInTheDocument();
  });

  it('renders multiple toasts independently', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TriggerButton message="First" />
        <TriggerButton message="Second" />
      </ToastProvider>,
    );

    await user.click(screen.getAllByRole('button', { name: 'Trigger' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Trigger' })[1]);

    expect(await screen.findByText('First')).toBeInTheDocument();
    expect(await screen.findByText('Second')).toBeInTheDocument();
  });

  /**
   * FE-10.10 fix — this test previously hung for the full 5000ms
   * vitest default `testTimeout` under `vi.useFakeTimers()`, for two
   * independent, stacked reasons, both confirmed directly by bisecting
   * the test body with instrumentation (not guessed from the error
   * message alone):
   *
   * 1. `userEvent.click()` itself never resolved — confirmed by
   *    isolating it: the `await` on it never returned control, even
   *    with `userEvent.setup({ delay: null, advanceTimers:
   *    vi.advanceTimersByTime })` (the standard documented fix for
   *    user-event + fake-timers interop) already in place. Something
   *    in this version's own internal event-dispatch chain (beyond the
   *    documented `delay`/`advanceTimers` options, which only cover
   *    `wait()`'s own explicit inter-event delays — confirmed directly
   *    by reading `wait.js`: it's a synchronous no-op whenever `delay`
   *    isn't a number) still depends on a real timer tick this fake
   *    clock never provides. `fireEvent.click()` is a synchronous DOM
   *    dispatch with none of that internal async machinery — the
   *    button's `onClick` fires identically either way for a plain
   *    click with no hover/position simulation needed, so nothing
   *    about what this test actually verifies changes.
   * 2. Separately, `waitFor()`'s own internal re-check polling also
   *    depends on real timer ticks (or further fake-clock advancement)
   *    to ever re-run — confirmed directly: replacing it with a
   *    synchronous assertion immediately after `vi.advanceTimersByTime(5000)`
   *    (wrapped in `act()` so the resulting `setToasts` state update
   *    flushes before the assertion runs) passes instantly, where
   *    `waitFor` hung for the same reason `user.click` did. Since the
   *    exact dismiss instant is already known and already advanced to
   *    in one synchronous jump, polling was never actually needed here.
   */
  it('auto-dismisses a toast after the timeout', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <TriggerButton message="Temporary message" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByText('Temporary message')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Temporary message')).not.toBeInTheDocument();
  });
});
