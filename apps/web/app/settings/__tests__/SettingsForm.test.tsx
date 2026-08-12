import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateMyPreferencesMock = vi.fn();
vi.mock('../actions', () => ({
  updateMyPreferences: (...args: unknown[]) => updateMyPreferencesMock(...args),
}));

import { SettingsForm } from '../SettingsForm';

beforeEach(() => {
  updateMyPreferencesMock.mockReset();
});

describe('SettingsForm', () => {
  it('pre-fills every field from initial* props', () => {
    render(<SettingsForm initialTheme="DARK" initialLanguage="en" initialTimezone="Africa/Lagos" />);

    expect(screen.getByLabelText('Theme')).toHaveValue('DARK');
    expect(screen.getByLabelText('Language (optional)')).toHaveValue('en');
    expect(screen.getByLabelText('Timezone (optional)')).toHaveValue('Africa/Lagos');
  });

  it('submits the current (unedited) values verbatim', async () => {
    updateMyPreferencesMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SettingsForm initialTheme="SYSTEM" initialLanguage="" initialTimezone="" />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateMyPreferencesMock).toHaveBeenCalledWith({
      theme: 'SYSTEM',
      language: undefined,
      timezone: undefined,
    });
  });

  it('submits edited values', async () => {
    updateMyPreferencesMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SettingsForm initialTheme="SYSTEM" initialLanguage="" initialTimezone="" />);

    await user.selectOptions(screen.getByLabelText('Theme'), 'LIGHT');
    await user.type(screen.getByLabelText('Language (optional)'), 'fr');
    await user.type(screen.getByLabelText('Timezone (optional)'), 'UTC');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateMyPreferencesMock).toHaveBeenCalledWith({
      theme: 'LIGHT',
      language: 'fr',
      timezone: 'UTC',
    });
  });

  it('shows a confirmation after a successful save', async () => {
    updateMyPreferencesMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SettingsForm initialTheme="SYSTEM" initialLanguage="" initialTimezone="" />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('shows the returned error message on failure, not a success confirmation', async () => {
    updateMyPreferencesMock.mockResolvedValue({ ok: false, error: 'Failed to save settings.' });
    const user = userEvent.setup();
    render(<SettingsForm initialTheme="SYSTEM" initialLanguage="" initialTimezone="" />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to save settings.')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('disables the submit button while a save is in flight', async () => {
    let resolveFn!: (v: { ok: boolean }) => void;
    updateMyPreferencesMock.mockReturnValue(new Promise((resolve) => { resolveFn = resolve; }));
    const user = userEvent.setup();
    render(<SettingsForm initialTheme="SYSTEM" initialLanguage="" initialTimezone="" />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    resolveFn({ ok: true });
    expect(await screen.findByRole('button', { name: 'Save' })).not.toBeDisabled();
  });
});
