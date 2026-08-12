import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionForm } from '../ActionForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ActionForm — form-action DOM attribute', () => {
  it('never sets a form "action" DOM attribute, the same regression guard LogoutButton.test.tsx uses', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke</button>
      </ActionForm>,
    );

    const form = screen.getByRole('button', { name: 'Revoke' }).closest('form') as HTMLFormElement;
    expect(form.getAttribute('action')).toBeNull();
  });

  it('does not navigate via native form submission', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke</button>
      </ActionForm>,
    );

    const form = screen.getByRole('button', { name: 'Revoke' }).closest('form') as HTMLFormElement;
    const submitSpy = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener('submit', submitSpy);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy.mock.calls[0][0].defaultPrevented).toBe(true);
  });
});

describe('ActionForm — calling the action', () => {
  it('calls the action with this form\u2019s own FormData on submit', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <input name="deviceName" defaultValue="My phone" />
        <button type="submit">Save</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.get('deviceName')).toBe('My phone');
  });

  it('works with a zero-argument action (e.g. revokeOtherSessions), ignoring the FormData it still receives', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke all other sessions</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole('button', { name: 'Revoke all other sessions' }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});

describe('ActionForm — error display', () => {
  it('shows the returned error message when the action reports failure', async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: 'Failed to revoke session.' });
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Failed to revoke session.')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action reports failure with no message', async () => {
    const action = vi.fn().mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Action failed.')).toBeInTheDocument();
  });

  it('shows no error when the action succeeds', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Action failed.')).not.toBeInTheDocument();
  });

  it('treats a void-resolving action (no return value at all) as success', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Action failed.')).not.toBeInTheDocument();
  });

  it('clears a previous error on a fresh submit attempt', async () => {
    const action = vi.fn().mockResolvedValueOnce({ ok: false, error: 'First failure.' }).mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('First failure.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(screen.queryByText('First failure.')).not.toBeInTheDocument());
  });
});

describe('ActionForm — pending state', () => {
  it('disables its fields while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    const action = vi.fn().mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(
      <ActionForm action={action}>
        <button type="submit">Revoke</button>
      </ActionForm>,
    );

    const button = screen.getByRole('button', { name: 'Revoke' });
    await user.click(button);

    expect(button).toBeDisabled();

    resolveAction({ ok: true });
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
