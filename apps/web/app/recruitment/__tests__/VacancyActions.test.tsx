import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same reasoning as CreateVacancyForm.test.tsx's own ./actions mock:
// publishVacancy/closeVacancy are 'use server' actions, not a real
// server in this test environment.
const publishVacancyMock = vi.fn();
const closeVacancyMock = vi.fn();
vi.mock('../actions', () => ({
  publishVacancy: (...args: unknown[]) => publishVacancyMock(...args),
  closeVacancy: (...args: unknown[]) => closeVacancyMock(...args),
}));

import { VacancyActions } from '../VacancyActions';

beforeEach(() => {
  publishVacancyMock.mockReset();
  closeVacancyMock.mockReset();
});

describe('VacancyActions', () => {
  it('shows only Publish for a DRAFT vacancy', () => {
    render(<VacancyActions id="vac-1" status="DRAFT" />);

    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark filled' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('shows both Publish and Close actions for an ON_HOLD vacancy', () => {
    render(<VacancyActions id="vac-1" status="ON_HOLD" />);

    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark filled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows only Close actions (no Publish) for an OPEN vacancy', () => {
    render(<VacancyActions id="vac-1" status="OPEN" />);

    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark filled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows no actions, just a dash, for a terminal CLOSED or FILLED vacancy', () => {
    const { rerender } = render(<VacancyActions id="vac-1" status="CLOSED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    rerender(<VacancyActions id="vac-1" status="FILLED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls publishVacancy with the vacancy id when Publish is clicked', async () => {
    publishVacancyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<VacancyActions id="vac-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(publishVacancyMock).toHaveBeenCalledWith('vac-42');
  });

  it('calls closeVacancy with filled=true when Mark filled is clicked', async () => {
    closeVacancyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<VacancyActions id="vac-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Mark filled' }));

    expect(closeVacancyMock).toHaveBeenCalledWith('vac-42', true);
  });

  it('calls closeVacancy with filled=false when Close is clicked', async () => {
    closeVacancyMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<VacancyActions id="vac-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(closeVacancyMock).toHaveBeenCalledWith('vac-42', false);
  });

  it('shows the action-returned error message on failure', async () => {
    publishVacancyMock.mockResolvedValue({ ok: false, error: 'Vacancy vac-42 cannot be published from status OPEN' });
    const user = userEvent.setup();
    render(<VacancyActions id="vac-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Vacancy vac-42 cannot be published from status OPEN')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    closeVacancyMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<VacancyActions id="vac-42" status="OPEN" />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Failed to close vacancy.')).toBeInTheDocument();
  });

  it('disables all actions and shows a pending label while a request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    closeVacancyMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<VacancyActions id="vac-42" status="ON_HOLD" />);

    await user.click(screen.getByRole('button', { name: 'Mark filled' }));

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Mark filled' })).not.toBeDisabled();
  });
});
