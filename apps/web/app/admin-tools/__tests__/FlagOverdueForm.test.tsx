import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@7f/ui';

const flagOverdueMock = vi.fn();
vi.mock('../actions', () => ({
  flagOverdueCorrectiveActions: (...args: unknown[]) => flagOverdueMock(...args),
}));

import { FlagOverdueForm } from '../FlagOverdueForm';

beforeEach(() => {
  flagOverdueMock.mockReset();
});

describe('FlagOverdueForm', () => {
  it('renders the date field and submit button, with the field required and starting blank', () => {
    render(<FlagOverdueForm />);

    const field = screen.getByLabelText('As of date');
    expect(field).toBeInTheDocument();
    expect(field).toBeRequired();
    expect(field).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Flag overdue corrective actions' })).toBeInTheDocument();
  });

  it('submits the entered date to flagOverdueCorrectiveActions', async () => {
    flagOverdueMock.mockResolvedValue({ ok: true, flagged: 3 });
    const user = userEvent.setup();
    render(<FlagOverdueForm />);

    await user.type(screen.getByLabelText('As of date'), '2026-08-02');
    await user.click(screen.getByRole('button', { name: 'Flag overdue corrective actions' }));

    expect(flagOverdueMock).toHaveBeenCalledWith('2026-08-02');
  });

  it('shows the flagged count, correctly pluralized, after a successful run', async () => {
    flagOverdueMock.mockResolvedValue({ ok: true, flagged: 3 });
    const user = userEvent.setup();
    render(<FlagOverdueForm />);

    await user.type(screen.getByLabelText('As of date'), '2026-08-02');
    await user.click(screen.getByRole('button', { name: 'Flag overdue corrective actions' }));

    expect(await screen.findByText('3 corrective actions flagged as overdue.')).toBeInTheDocument();
  });

  it('uses the singular form when exactly one action is flagged', async () => {
    flagOverdueMock.mockResolvedValue({ ok: true, flagged: 1 });
    const user = userEvent.setup();
    render(<FlagOverdueForm />);

    await user.type(screen.getByLabelText('As of date'), '2026-08-02');
    await user.click(screen.getByRole('button', { name: 'Flag overdue corrective actions' }));

    expect(await screen.findByText('1 corrective action flagged as overdue.')).toBeInTheDocument();
  });

  it('shows a zero-count result without treating it as an error', async () => {
    flagOverdueMock.mockResolvedValue({ ok: true, flagged: 0 });
    const user = userEvent.setup();
    render(<FlagOverdueForm />);

    await user.type(screen.getByLabelText('As of date'), '2026-08-02');
    await user.click(screen.getByRole('button', { name: 'Flag overdue corrective actions' }));

    expect(await screen.findByText('0 corrective actions flagged as overdue.')).toBeInTheDocument();
  });

  it('shows the action-returned error message on failure, without a result message', async () => {
    flagOverdueMock.mockResolvedValue({ ok: false, error: 'Invalid date' });
    const user = userEvent.setup();
    render(<FlagOverdueForm />);

    await user.type(screen.getByLabelText('As of date'), '2026-08-02');
    await user.click(screen.getByRole('button', { name: 'Flag overdue corrective actions' }));

    expect(await screen.findByText('Invalid date')).toBeInTheDocument();
    expect(screen.queryByText(/flagged as overdue/)).not.toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    flagOverdueMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<FlagOverdueForm />);

    await user.type(screen.getByLabelText('As of date'), '2026-08-02');
    await user.click(screen.getByRole('button', { name: 'Flag overdue corrective actions' }));

    expect(await screen.findByText('Failed to flag overdue corrective actions.')).toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean; flagged?: number }) => void = () => {};
    flagOverdueMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<FlagOverdueForm />);

    await user.type(screen.getByLabelText('As of date'), '2026-08-02');
    await user.click(screen.getByRole('button', { name: 'Flag overdue corrective actions' }));

    const pendingButton = screen.getByRole('button', { name: 'Flagging…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true, flagged: 2 });
    expect(await screen.findByRole('button', { name: 'Flag overdue corrective actions' })).not.toBeDisabled();
  });

  it('also shows a toast alongside the existing inline message when a ToastProvider is mounted (FE-10.1)', async () => {
    flagOverdueMock.mockResolvedValue({ ok: true, flagged: 4 });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <FlagOverdueForm />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText('As of date'), '2026-08-02');
    await user.click(screen.getByRole('button', { name: 'Flag overdue corrective actions' }));

    // Two copies of the same message: the form's own inline confirmation,
    // plus the new toast — both are expected to coexist.
    expect(await screen.findAllByText('4 corrective actions flagged as overdue.')).toHaveLength(2);
  });
});
